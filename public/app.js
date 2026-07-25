const API = '/api';

let pedidoAtual = null;   // pedido (mesa ou outros) aberto na tela
let itemSelecionado = null; // item do cardapio selecionado antes de confirmar
let itemEditando = null;    // item ja adicionado, sendo editado (lapis)

const formatarReais = (v) => 'R$ ' + v.toFixed(2).replace('.', ',');

// ---------------- MENU LATERAL ----------------
document.querySelectorAll('.menu-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    const secao = btn.dataset.secao;
    document.querySelectorAll('.secao').forEach(s => s.classList.add('escondida'));
    document.getElementById('secao-' + secao).classList.remove('escondida');
    if (secao === 'mesas') carregarMesas();
    else carregarOutros();
  });
});

// ---------------- CARREGAR MESAS ----------------
async function carregarMesas() {
  const resp = await fetch(`${API}/mesas`);
  const mesas = await resp.json();
  const grade = document.getElementById('grade-mesas');
  grade.innerHTML = '';
  mesas.forEach(mesa => grade.appendChild(criarCardMesa(mesa)));
}

function criarCardMesa(pedido) {
  const total = (pedido.itens || []).reduce((s, i) => s + i.preco * i.quantidade, 0);
  const div = document.createElement('div');
  div.className = 'card-mesa' + (pedido.itens.length ? ' ocupada' : '');
  div.innerHTML = `
    <div class="card-numero">${pedido.numero}</div>
    <div class="card-comanda">Comanda: ${pedido.comanda ? pedido.comanda : '--'}</div>
    <div class="card-total ${pedido.itens.length ? '' : 'vazio'}">
      ${pedido.itens.length ? formatarReais(total) : 'Sem pedido'}
    </div>
  `;
  div.addEventListener('click', () => abrirPainelPedido(pedido, `Mesa ${pedido.numero}`));
  return div;
}

document.getElementById('btn-add-mesa').addEventListener('click', async () => {
  await fetch(`${API}/mesas`, { method: 'POST' });
  carregarMesas();
});

// ---------------- CARREGAR OUTROS ----------------
async function carregarOutros() {
  const resp = await fetch(`${API}/outros`);
  const pedidos = await resp.json();
  const grade = document.getElementById('grade-outros');
  grade.innerHTML = '';
  pedidos.forEach(p => grade.appendChild(criarCardMesa(p)));
  if (pedidos.length === 0) {
    // garante pelo menos 1 pedido inicial
  }
}

document.getElementById('btn-add-outros').addEventListener('click', async () => {
  await fetch(`${API}/outros`, { method: 'POST' });
  carregarOutros();
});

// cria automaticamente o primeiro pedido de "Outros" se a lista estiver vazia
async function garantirPrimeiroOutros() {
  const resp = await fetch(`${API}/outros`);
  const pedidos = await resp.json();
  if (pedidos.length === 0) {
    await fetch(`${API}/outros`, { method: 'POST' });
  }
}

// ---------------- PAINEL DE PEDIDO ----------------
function abrirPainelPedido(pedido, titulo) {
  pedidoAtual = pedido;
  document.getElementById('pedido-titulo').textContent = titulo;
  document.getElementById('pedido-comanda').textContent = pedido.comanda || '--';
  renderizarItens();
  document.getElementById('busca-item').value = '';
  document.getElementById('sugestoes').classList.add('escondida');
  document.getElementById('tela-pedido').classList.remove('escondida');
}

document.getElementById('btn-fechar-painel').addEventListener('click', () => {
  document.getElementById('tela-pedido').classList.add('escondida');
  // recarrega a lista que estava visivel
  if (!document.getElementById('secao-mesas').classList.contains('escondida')) carregarMesas();
  else carregarOutros();
});

document.getElementById('btn-editar-comanda').addEventListener('click', async () => {
  const numero = prompt('Escaneie ou digite o número da comanda:');
  if (numero === null) return;
  const resp = await fetch(`${API}/mesas/${pedidoAtual._id}/comanda`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comanda: numero })
  });
  pedidoAtual = await resp.json();
  document.getElementById('pedido-comanda').textContent = pedidoAtual.comanda || '--';
});

function renderizarItens() {
  const lista = document.getElementById('lista-itens');
  lista.innerHTML = '';
  if (!pedidoAtual.itens.length) {
    lista.innerHTML = '<div class="vazio-msg">Nenhum item lançado ainda</div>';
  }
  let total = 0;
  pedidoAtual.itens.forEach(item => {
    total += item.preco * item.quantidade;
    const linha = document.createElement('div');
    linha.className = 'linha-item';
    linha.innerHTML = `
      <div>
        <span class="nome">${item.nome}</span>
        <span class="qtd">x${item.quantidade}</span>
      </div>
      <div class="direita">
        <span class="subtotal">${formatarReais(item.preco * item.quantidade)}</span>
        <button class="btn-icone editar" title="Alterar">✏️</button>
        <button class="btn-icone excluir" title="Remover">🗑️</button>
      </div>
    `;
    linha.querySelector('.editar').addEventListener('click', () => abrirModalEdicao(item));
    linha.querySelector('.excluir').addEventListener('click', () => removerItem(item));
    lista.appendChild(linha);
  });
  document.getElementById('pedido-total').textContent = formatarReais(total);
}

async function removerItem(item) {
  const resp = await fetch(`${API}/pedidos/${pedidoAtual._id}/itens/${item._id}`, { method: 'DELETE' });
  pedidoAtual = await resp.json();
  renderizarItens();
}

// ---------------- BUSCA / AUTOCOMPLETAR ----------------
const inputBusca = document.getElementById('busca-item');
const caixaSugestoes = document.getElementById('sugestoes');
let timerBusca = null;

inputBusca.addEventListener('input', () => {
  clearTimeout(timerBusca);
  const termo = inputBusca.value.trim();
  if (!termo) { caixaSugestoes.classList.add('escondida'); return; }
  timerBusca = setTimeout(() => buscarItens(termo), 200);
});

async function buscarItens(termo) {
  const resp = await fetch(`${API}/itens?busca=${encodeURIComponent(termo)}`);
  const itens = await resp.json();
  caixaSugestoes.innerHTML = '';
  if (!itens.length) { caixaSugestoes.classList.add('escondida'); return; }
  itens.forEach(item => {
    const div = document.createElement('div');
    div.className = 'sugestao-item';
    div.innerHTML = `<span>${item.nome}</span><span class="preco">${item.diverso ? 'valor livre' : formatarReais(item.preco)}</span>`;
    div.addEventListener('click', () => {
      itemSelecionado = item;
      itemEditando = null;
      abrirModalItem(item);
      caixaSugestoes.classList.add('escondida');
      inputBusca.value = '';
    });
    caixaSugestoes.appendChild(div);
  });
  caixaSugestoes.classList.remove('escondida');
}

// ---------------- MODAL DE QUANTIDADE / DIVERSOS ----------------
const modalItem = document.getElementById('modal-item');
let qtdModal = 1;

function abrirModalItem(item) {
  qtdModal = 1;
  document.getElementById('modal-item-nome').textContent = item.nome;
  document.getElementById('qtd-valor').textContent = qtdModal;
  const campoPreco = document.getElementById('campo-preco-diverso');
  if (item.diverso) {
    campoPreco.classList.remove('escondida');
    document.getElementById('modal-preco').value = '';
  } else {
    campoPreco.classList.add('escondida');
  }
  modalItem.classList.remove('escondida');
}

function abrirModalEdicao(itemDoPedido) {
  itemEditando = itemDoPedido;
  itemSelecionado = null;
  qtdModal = itemDoPedido.quantidade;
  document.getElementById('modal-item-nome').textContent = itemDoPedido.nome;
  document.getElementById('qtd-valor').textContent = qtdModal;
  document.getElementById('campo-preco-diverso').classList.remove('escondida');
  document.getElementById('modal-preco').value = itemDoPedido.preco;
  modalItem.classList.remove('escondida');
}

document.getElementById('qtd-mais').addEventListener('click', () => {
  qtdModal++;
  document.getElementById('qtd-valor').textContent = qtdModal;
});
document.getElementById('qtd-menos').addEventListener('click', () => {
  if (qtdModal > 1) qtdModal--;
  document.getElementById('qtd-valor').textContent = qtdModal;
});

document.getElementById('modal-cancelar').addEventListener('click', () => {
  modalItem.classList.add('escondida');
  itemSelecionado = null;
  itemEditando = null;
});

document.getElementById('modal-confirmar').addEventListener('click', async () => {
  if (itemEditando) {
    const precoInput = document.getElementById('modal-preco').value;
    const body = { quantidade: qtdModal };
    if (precoInput !== '') body.preco = parseFloat(precoInput);
    const resp = await fetch(`${API}/pedidos/${pedidoAtual._id}/itens/${itemEditando._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    pedidoAtual = await resp.json();
  } else if (itemSelecionado) {
    let preco = itemSelecionado.preco;
    if (itemSelecionado.diverso) {
      preco = parseFloat(document.getElementById('modal-preco').value) || 0;
    }
    const resp = await fetch(`${API}/pedidos/${pedidoAtual._id}/itens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: itemSelecionado.nome, preco, quantidade: qtdModal })
    });
    pedidoAtual = await resp.json();
  }
  renderizarItens();
  modalItem.classList.add('escondida');
  itemSelecionado = null;
  itemEditando = null;
});

// ---------------- FINALIZAR CONTA ----------------
const modalConfirmacao = document.getElementById('modal-confirmacao');

document.getElementById('btn-finalizar').addEventListener('click', () => {
  document.getElementById('confirmacao-texto').textContent = 'Deseja encerrar esse pedido?';
  modalConfirmacao.classList.remove('escondida');
});

document.getElementById('confirmacao-nao').addEventListener('click', () => {
  modalConfirmacao.classList.add('escondida');
});

document.getElementById('confirmacao-sim').addEventListener('click', async () => {
  await fetch(`${API}/pedidos/${pedidoAtual._id}/finalizar`, { method: 'POST' });
  modalConfirmacao.classList.add('escondida');
  document.getElementById('tela-pedido').classList.add('escondida');
  if (!document.getElementById('secao-mesas').classList.contains('escondida')) carregarMesas();
  else carregarOutros();
});

// ---------------- INICIO ----------------
(async function iniciar() {
  await garantirPrimeiroOutros();
  carregarMesas();
})();
