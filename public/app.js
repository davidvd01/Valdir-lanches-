const API = '/api';

let pedidoAtual = null;   // pedido (mesa ou outros) aberto na tela
let itemSelecionado = null; // item do cardapio selecionado antes de confirmar
let itemEditando = null;    // item ja adicionado, sendo editado (lapis)
let pedidoParaExcluir = null; // mesa/pedido marcado pra excluir (lixeira do card)

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
    else if (secao === 'outros') carregarOutros();
    else if (secao === 'cardapio') carregarCardapio();
    else if (secao === 'finalizados') carregarFinalizados();
    else if (secao === 'cozinha') carregarCozinha();
  });
});

// ---------------- CARREGAR MESAS ----------------
async function carregarMesas() {
  const resp = await fetch(`${API}/mesas`);
  const mesas = await resp.json();
  const grade = document.getElementById('grade-mesas');
  grade.innerHTML = '';
  mesas.forEach(mesa => grade.appendChild(criarCardMesa(mesa)));
  grade.appendChild(criarCardAcoes('+ Mesa', async () => {
    await fetch(`${API}/mesas`, { method: 'POST' });
    carregarMesas();
  }));
}

function criarCardAcoes(textoAdicionar, aoAdicionar) {
  const div = document.createElement('div');
  div.className = 'card-acoes';
  div.innerHTML = `
    <button class="metade-acao topo">
      <span class="simbolo-mais">+</span> ${textoAdicionar}
    </button>
    <button class="metade-acao baixo">🔍 Buscar comanda</button>
  `;
  div.querySelector('.topo').addEventListener('click', aoAdicionar);
  div.querySelector('.baixo').addEventListener('click', buscarEAbrirComanda);
  return div;
}

function criarCardMesa(pedido) {
  const total = (pedido.itens || []).reduce((s, i) => s + i.preco * i.quantidade, 0);
  const div = document.createElement('div');
  div.className = 'card-mesa' + (pedido.itens.length ? ' ocupada' : '');
  div.innerHTML = `
    <button class="btn-excluir-card" title="Excluir">🗑️</button>
    <div class="card-numero">${pedido.numero}</div>
    <div class="card-comanda">Comanda: <span class="valor-comanda${pedido.comanda ? ' definida' : ''}">${pedido.comanda ? pedido.comanda : '--'}</span></div>
    <div class="card-total ${pedido.itens.length ? '' : 'vazio'}">
      ${pedido.itens.length ? formatarReais(total) : 'Sem pedido'}
    </div>
  `;
  div.addEventListener('click', () => {
    const titulo = pedido.tipo === 'mesa' ? `Mesa ${pedido.numero}` : `Pedido ${pedido.numero}`;
    abrirPainelPedido(pedido, titulo);
  });
  div.querySelector('.btn-excluir-card').addEventListener('click', (ev) => {
    ev.stopPropagation();
    confirmarExclusaoCard(pedido);
  });
  return div;
}

function confirmarExclusaoCard(pedido) {
  const rotulo = pedido.tipo === 'mesa' ? `a Mesa ${pedido.numero}` : `o Pedido ${pedido.numero}`;
  document.getElementById('confirmacao-texto').textContent = `Deseja excluir ${rotulo}?`;
  modalConfirmacao.classList.remove('escondida');
  modalConfirmacao.dataset.acao = 'excluir-card';
  pedidoParaExcluir = pedido;
}

// ---------------- CARREGAR OUTROS ----------------
async function carregarOutros() {
  const resp = await fetch(`${API}/outros`);
  const pedidos = await resp.json();
  const grade = document.getElementById('grade-outros');
  grade.innerHTML = '';
  pedidos.forEach(p => grade.appendChild(criarCardMesa(p)));
  grade.appendChild(criarCardAcoes('+ Pedido', async () => {
    await fetch(`${API}/outros`, { method: 'POST' });
    carregarOutros();
  }));
}

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
  atualizarComandaNoPainel();
  renderizarItens();
  document.getElementById('busca-item').value = '';
  document.getElementById('sugestoes').classList.add('escondida');
  document.getElementById('tela-pedido').classList.remove('escondida');
}

function atualizarComandaNoPainel() {
  const span = document.getElementById('pedido-comanda');
  span.textContent = pedidoAtual.comanda || '--';
  span.classList.toggle('definida', !!pedidoAtual.comanda);
}

document.getElementById('btn-fechar-painel').addEventListener('click', () => {
  document.getElementById('tela-pedido').classList.add('escondida');
  // recarrega a lista que estava visivel
  if (!document.getElementById('secao-mesas').classList.contains('escondida')) carregarMesas();
  else if (!document.getElementById('secao-outros').classList.contains('escondida')) carregarOutros();
});

document.getElementById('btn-editar-comanda').addEventListener('click', () => {
  document.getElementById('modal-comanda-titulo').textContent = 'Definir comanda';
  document.getElementById('modal-comanda-valor').value = pedidoAtual.comanda || '';
  modalComanda.dataset.modo = 'definir';
  modalComanda.classList.remove('escondida');
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
      <input type="checkbox" class="checkbox-envio" data-id="${item._id}">
      <div class="conteudo-item">
        <span class="nome">${item.nome}</span>
        <span class="qtd">x${item.quantidade}</span>
        ${item.observacao ? `<div class="obs-item">${item.observacao}</div>` : ''}
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

// ---------------- BUSCA / AUTOCOMPLETAR (dentro do pedido) ----------------
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

// ---------------- MODAL DE QUANTIDADE / OBSERVACAO / DIVERSOS ----------------
const modalItem = document.getElementById('modal-item');
let qtdModal = 1;

function abrirModalItem(item) {
  qtdModal = 1;
  document.getElementById('modal-item-titulo').textContent = item.nome;
  document.getElementById('qtd-valor').textContent = qtdModal;
  document.getElementById('modal-observacao').value = '';
  document.getElementById('modal-nome').value = '';
  const campoNome = document.getElementById('campo-nome-item');
  const campoPreco = document.getElementById('campo-preco-diverso');
  if (item.diverso) {
    campoNome.classList.remove('escondida');
    campoPreco.classList.remove('escondida');
    document.getElementById('modal-preco').value = '';
    document.querySelector('#campo-nome-item label').textContent = 'O que é? (aparece no lugar de "Diversos")';
  } else {
    campoNome.classList.add('escondida');
    campoPreco.classList.add('escondida');
  }
  document.getElementById('modal-confirmar').textContent = 'Adicionar';
  modalItem.classList.remove('escondida');
}

function abrirModalEdicao(itemDoPedido) {
  itemEditando = itemDoPedido;
  itemSelecionado = null;
  qtdModal = itemDoPedido.quantidade;
  document.getElementById('modal-item-titulo').textContent = 'Alterar item';
  document.getElementById('qtd-valor').textContent = qtdModal;
  document.getElementById('campo-nome-item').classList.remove('escondida');
  document.querySelector('#campo-nome-item label').textContent = 'Nome do item';
  document.getElementById('modal-nome').value = itemDoPedido.nome;
  document.getElementById('campo-preco-diverso').classList.remove('escondida');
  document.getElementById('modal-preco').value = itemDoPedido.preco;
  document.getElementById('modal-observacao').value = itemDoPedido.observacao || '';
  document.getElementById('modal-confirmar').textContent = 'Salvar';
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
  const observacao = document.getElementById('modal-observacao').value.trim();
  if (itemEditando) {
    const precoInput = document.getElementById('modal-preco').value;
    const nomeInput = document.getElementById('modal-nome').value.trim();
    const body = { quantidade: qtdModal, observacao };
    if (precoInput !== '') body.preco = parseFloat(precoInput);
    if (nomeInput !== '') body.nome = nomeInput;
    const resp = await fetch(`${API}/pedidos/${pedidoAtual._id}/itens/${itemEditando._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    pedidoAtual = await resp.json();
  } else if (itemSelecionado) {
    let preco = itemSelecionado.preco;
    let nome = itemSelecionado.nome;
    if (itemSelecionado.diverso) {
      preco = parseFloat(document.getElementById('modal-preco').value) || 0;
      const nomeDigitado = document.getElementById('modal-nome').value.trim();
      if (nomeDigitado) nome = nomeDigitado;
    }
    const resp = await fetch(`${API}/pedidos/${pedidoAtual._id}/itens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, preco, quantidade: qtdModal, observacao })
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
  modalConfirmacao.dataset.acao = 'finalizar-pedido';
});

document.getElementById('confirmacao-nao').addEventListener('click', () => {
  modalConfirmacao.classList.add('escondida');
  modalConfirmacao.dataset.acao = '';
  pedidoParaExcluir = null;
});

document.getElementById('confirmacao-sim').addEventListener('click', async () => {
  if (modalConfirmacao.dataset.acao !== 'finalizar-pedido') return;
  await fetch(`${API}/pedidos/${pedidoAtual._id}/finalizar`, { method: 'POST' });
  modalConfirmacao.classList.add('escondida');
  modalConfirmacao.dataset.acao = '';
  document.getElementById('tela-pedido').classList.add('escondida');
  if (!document.getElementById('secao-mesas').classList.contains('escondida')) carregarMesas();
  else if (!document.getElementById('secao-outros').classList.contains('escondida')) carregarOutros();
});

// ---------------- CARDAPIO (gerenciar itens) ----------------
let todosOsItens = [];
let itemCardapioEditando = null;

async function carregarCardapio() {
  const resp = await fetch(`${API}/itens/todos`);
  todosOsItens = await resp.json();
  renderizarCardapio(todosOsItens);
}

function renderizarCardapio(itens) {
  const lista = document.getElementById('lista-cardapio');
  lista.innerHTML = '';
  itens.filter(i => !i.diverso).forEach(item => {
    const linha = document.createElement('div');
    linha.className = 'linha-cardapio';
    linha.innerHTML = `
      <div>
        <span class="cat">${item.categoria || ''}</span>
        <span class="nome-item">${item.nome}</span>
      </div>
      <span class="preco-item">${formatarReais(item.preco)}</span>
    `;
    linha.addEventListener('click', () => abrirModalCardapio(item));
    lista.appendChild(linha);
  });
}

document.getElementById('cardapio-busca').addEventListener('input', (e) => {
  const termo = e.target.value.toLowerCase();
  renderizarCardapio(todosOsItens.filter(i => i.nome.toLowerCase().includes(termo)));
});

const modalCardapioItem = document.getElementById('modal-cardapio-item');

function abrirModalCardapio(item) {
  itemCardapioEditando = item || null;
  document.getElementById('cardapio-modal-titulo').textContent = item ? 'Editar item' : 'Novo item';
  document.getElementById('cardapio-modal-nome').value = item ? item.nome : '';
  document.getElementById('cardapio-modal-preco').value = item ? item.preco : '';
  document.getElementById('cardapio-modal-categoria').value = item ? (item.categoria || '') : '';
  document.getElementById('cardapio-modal-excluir').style.display = item ? 'inline-block' : 'none';
  modalCardapioItem.classList.remove('escondida');
}

document.getElementById('btn-novo-item').addEventListener('click', () => abrirModalCardapio(null));

document.getElementById('cardapio-modal-cancelar').addEventListener('click', () => {
  modalCardapioItem.classList.add('escondida');
  itemCardapioEditando = null;
});

document.getElementById('cardapio-modal-salvar').addEventListener('click', async () => {
  const nome = document.getElementById('cardapio-modal-nome').value.trim();
  const preco = parseFloat(document.getElementById('cardapio-modal-preco').value) || 0;
  const categoria = document.getElementById('cardapio-modal-categoria').value.trim();
  if (!nome) { alert('Digite o nome do item.'); return; }

  if (itemCardapioEditando) {
    await fetch(`${API}/itens/${itemCardapioEditando._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, preco, categoria })
    });
  } else {
    await fetch(`${API}/itens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, preco, categoria })
    });
  }
  modalCardapioItem.classList.add('escondida');
  itemCardapioEditando = null;
  carregarCardapio();
});

document.getElementById('cardapio-modal-excluir').addEventListener('click', async () => {
  if (!itemCardapioEditando) return;
  if (!confirm(`Excluir "${itemCardapioEditando.nome}" do cardápio?`)) return;
  await fetch(`${API}/itens/${itemCardapioEditando._id}`, { method: 'DELETE' });
  modalCardapioItem.classList.add('escondida');
  itemCardapioEditando = null;
  carregarCardapio();
});

// ---------------- FINALIZAR COMANDA (busca rapida) ----------------
async function buscarEAbrirComanda() {
  document.getElementById('modal-comanda-titulo').textContent = 'Buscar comanda';
  document.getElementById('modal-comanda-valor').value = '';
  modalComanda.dataset.modo = 'buscar';
  modalComanda.classList.remove('escondida');
}

async function executarBuscaComanda(valor) {
  const alvo = valor.trim().toLowerCase();
  const [mesas, outros] = await Promise.all([
    fetch(`${API}/mesas`).then(r => r.json()),
    fetch(`${API}/outros`).then(r => r.json())
  ]);
  const achadaMesa = mesas.find(m => (m.comanda || '').trim().toLowerCase() === alvo);
  if (achadaMesa) { abrirPainelPedido(achadaMesa, `Mesa ${achadaMesa.numero}`); return; }
  const achadoOutro = outros.find(o => (o.comanda || '').trim().toLowerCase() === alvo);
  if (achadoOutro) { abrirPainelPedido(achadoOutro, `Pedido ${achadoOutro.numero}`); return; }
  alert(`Não encontrei nenhuma mesa ou pedido aberto com a comanda "${valor}".`);
}

document.getElementById('confirmacao-sim').addEventListener('click', async () => {
  if (modalConfirmacao.dataset.acao !== 'excluir-card' || !pedidoParaExcluir) return;
  const tipoExcluido = pedidoParaExcluir.tipo;
  await fetch(`${API}/pedidos/${pedidoParaExcluir._id}`, { method: 'DELETE' });
  modalConfirmacao.classList.add('escondida');
  modalConfirmacao.dataset.acao = '';
  pedidoParaExcluir = null;
  if (tipoExcluido === 'mesa') carregarMesas();
  else carregarOutros();
});

// ---------------- MODAL DE COMANDA (definir / buscar) COM CAMERA ----------------
const modalComanda = document.getElementById('modal-comanda');
const modalScanner = document.getElementById('modal-scanner');
let instanciaScanner = null;

document.getElementById('modal-comanda-cancelar').addEventListener('click', () => {
  modalComanda.classList.add('escondida');
});

document.getElementById('modal-comanda-confirmar').addEventListener('click', async () => {
  const valor = document.getElementById('modal-comanda-valor').value.trim();
  if (!valor) return;
  modalComanda.classList.add('escondida');
  if (modalComanda.dataset.modo === 'definir') {
    const resp = await fetch(`${API}/mesas/${pedidoAtual._id}/comanda`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comanda: valor })
    });
    pedidoAtual = await resp.json();
    atualizarComandaNoPainel();
  } else {
    executarBuscaComanda(valor);
  }
});

document.getElementById('btn-abrir-scanner').addEventListener('click', () => {
  modalScanner.classList.remove('escondida');
  instanciaScanner = new Html5Qrcode('leitor-scanner');
  instanciaScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: 250 },
    (textoLido) => {
      document.getElementById('modal-comanda-valor').value = textoLido;
      fecharScanner();
    },
    () => {} // erro de leitura de cada frame, ignorado (tenta de novo sozinho)
  ).catch(() => {
    alert('Não consegui acessar a câmera. Verifique se você permitiu o acesso, ou digite manualmente.');
    modalScanner.classList.add('escondida');
  });
});

function fecharScanner() {
  if (instanciaScanner) {
    instanciaScanner.stop().catch(() => {});
    instanciaScanner = null;
  }
  modalScanner.classList.add('escondida');
}

document.getElementById('scanner-cancelar').addEventListener('click', fecharScanner);

// ---------------- TRANSFERIR PEDIDO ----------------
const modalTransferir = document.getElementById('modal-transferir');

document.getElementById('btn-transferir').addEventListener('click', async () => {
  const [mesas, outros] = await Promise.all([
    fetch(`${API}/mesas`).then(r => r.json()),
    fetch(`${API}/outros`).then(r => r.json())
  ]);
  const lista = document.getElementById('lista-transferir');
  lista.innerHTML = '';
  const todos = [...mesas.map(m => ({ ...m, rotulo: `Mesa ${m.numero}` })),
                 ...outros.map(o => ({ ...o, rotulo: `Pedido ${o.numero}` }))]
    .filter(p => p._id !== pedidoAtual._id);

  todos.forEach(p => {
    const div = document.createElement('div');
    div.className = 'opcao-transferir';
    div.innerHTML = `<span>${p.rotulo}</span>${p.itens.length ? '<span class="tag-ocupada">ocupada</span>' : ''}`;
    div.addEventListener('click', async () => {
      await fetch(`${API}/pedidos/${pedidoAtual._id}/transferir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinoId: p._id })
      });
      modalTransferir.classList.add('escondida');
      document.getElementById('tela-pedido').classList.add('escondida');
      if (!document.getElementById('secao-mesas').classList.contains('escondida')) carregarMesas();
      else if (!document.getElementById('secao-outros').classList.contains('escondida')) carregarOutros();
    });
    lista.appendChild(div);
  });

  modalTransferir.classList.remove('escondida');
});

document.getElementById('transferir-cancelar').addEventListener('click', () => {
  modalTransferir.classList.add('escondida');
});

// ---------------- ENVIAR PARA COZINHA ----------------
document.getElementById('btn-enviar-cozinha').addEventListener('click', async () => {
  const marcados = Array.from(document.querySelectorAll('.checkbox-envio:checked'));
  if (!marcados.length) { alert('Selecione ao menos um item pra mandar pra cozinha.'); return; }

  const idsSelecionados = marcados.map(c => c.dataset.id);
  const itensParaEnviar = pedidoAtual.itens
    .filter(i => idsSelecionados.includes(i._id))
    .map(i => ({ nome: i.nome, observacao: i.observacao || '' }));

  const titulo = document.getElementById('pedido-titulo').textContent;
  const tipo = titulo.startsWith('Mesa') ? 'mesa' : 'outros';

  await fetch(`${API}/cozinha`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, numero: pedidoAtual.numero, comanda: pedidoAtual.comanda, itens: itensParaEnviar })
  });

  marcados.forEach(c => c.checked = false);
  alert('Enviado pra cozinha!');
});

// ---------------- ABA COZINHA (com bip de novo pedido) ----------------
let idsCozinhaConhecidos = new Set();
let primeiraChecagemCozinha = true;

// O Safari (iPhone) bloqueia qualquer som iniciado sozinho pela pagina ate a
// pessoa tocar na tela pelo menos uma vez. Por isso criamos o AudioContext
// aqui e "destravamos" ele no primeiro toque, guardando pra reusar depois -
// e o mesmo motivo de so tocar no computador e nao no celular antes.
let audioCtxGlobal = null;
function obterAudioContext() {
  if (!audioCtxGlobal) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtxGlobal = new Ctx();
  }
  return audioCtxGlobal;
}
function desbloquearAudioNoToque() {
  const ctx = obterAudioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}
document.addEventListener('touchstart', desbloquearAudioNoToque, { once: true });
document.addEventListener('click', desbloquearAudioNoToque, { once: true });

async function tocarBip() {
  const ctx = obterAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) {} }
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(ctx.destination);
    const inicio = ctx.currentTime + i * 0.35;
    osc.start(inicio);
    osc.stop(inicio + 0.2);
  }
}

function renderizarCozinha(tickets) {
  const grade = document.getElementById('grade-cozinha');
  grade.innerHTML = '';
  if (!tickets.length) {
    grade.innerHTML = '<div class="vazio-cozinha">Nenhum pedido pendente na cozinha.</div>';
    return;
  }
  tickets.forEach(t => {
    const div = document.createElement('div');
    div.className = 'card-cozinha';
    const titulo = t.tipo === 'mesa' ? `Mesa ${t.numero}` : `Pedido ${t.numero}`;
    div.innerHTML = `
      <div class="titulo-cozinha">${titulo}</div>
      <div class="comanda-cozinha">${t.comanda ? 'Comanda: ' + t.comanda : ''}</div>
      ${t.itens.map(i => `
        <div class="item-cozinha">
          <div class="nome-item-cozinha">${i.nome}</div>
          ${i.observacao ? `<div class="obs-item-cozinha">${i.observacao}</div>` : ''}
        </div>
      `).join('')}
      <button class="btn-pronto">✔ Pronto</button>
    `;
    div.querySelector('.btn-pronto').addEventListener('click', async () => {
      await fetch(`${API}/cozinha/${t._id}`, { method: 'DELETE' });
      idsCozinhaConhecidos.delete(t._id);
      carregarCozinha();
    });
    grade.appendChild(div);
  });
}

async function carregarCozinha() {
  const resp = await fetch(`${API}/cozinha`);
  const tickets = await resp.json();
  renderizarCozinha(tickets);
  idsCozinhaConhecidos = new Set(tickets.map(t => t._id));
  primeiraChecagemCozinha = false;
  atualizarBadgeCozinha(tickets.length);
  manterTelaAcordada();
}

let travaDeTela = null;
async function manterTelaAcordada() {
  try {
    if ('wakeLock' in navigator) {
      travaDeTela = await navigator.wakeLock.request('screen');
    }
  } catch (e) { /* alguns navegadores nao suportam, tudo bem, so nao trava a tela */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' &&
      !document.getElementById('secao-cozinha').classList.contains('escondida')) {
    manterTelaAcordada();
  }
});

// fica de olho o tempo todo (mesmo fora da aba Cozinha) se chegou pedido novo, e apita
async function verificarNovosPedidosCozinha() {
  try {
    const resp = await fetch(`${API}/cozinha`);
    const tickets = await resp.json();
    const idsAtuais = tickets.map(t => t._id);
    const temNovo = !primeiraChecagemCozinha && idsAtuais.some(id => !idsCozinhaConhecidos.has(id));
    if (primeiraChecagemCozinha) {
      idsCozinhaConhecidos = new Set(idsAtuais);
      primeiraChecagemCozinha = false;
      atualizarBadgeCozinha(idsAtuais.length);
      return;
    }
    if (temNovo) {
      tocarBip();
      mostrarToastNovoPedido();
      idsCozinhaConhecidos = new Set(idsAtuais);
      if (!document.getElementById('secao-cozinha').classList.contains('escondida')) {
        renderizarCozinha(tickets);
      }
    }
    atualizarBadgeCozinha(idsAtuais.length);
  } catch (e) { /* silencioso: se a rede falhar, so tenta de novo no proximo ciclo */ }
}
setInterval(verificarNovosPedidosCozinha, 5000);

function atualizarBadgeCozinha(quantidade) {
  const badge = document.getElementById('badge-cozinha');
  if (quantidade > 0) {
    badge.textContent = quantidade;
    badge.classList.remove('escondida');
  } else {
    badge.classList.add('escondida');
  }
}

let timeoutToast = null;
function mostrarToastNovoPedido() {
  const toast = document.getElementById('toast-cozinha');
  toast.classList.remove('escondida');
  clearTimeout(timeoutToast);
  timeoutToast = setTimeout(() => toast.classList.add('escondida'), 6000);
}

// ---------------- INICIO ----------------
(async function iniciar() {
  await garantirPrimeiroOutros();
  carregarMesas();
})();

// ---------------- FINALIZADOS / FECHAMENTO DE CAIXA ----------------
function hojeISO() {
  const hoje = new Date();
  const offset = hoje.getTimezoneOffset();
  const local = new Date(hoje.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

const inputDataFinalizados = document.getElementById('finalizados-data');
inputDataFinalizados.value = hojeISO();
inputDataFinalizados.addEventListener('change', carregarFinalizados);

async function carregarFinalizados() {
  const data = inputDataFinalizados.value || hojeISO();
  const resp = await fetch(`${API}/finalizados?data=${data}`);
  const finalizados = await resp.json();
  const lista = document.getElementById('lista-finalizados');
  lista.innerHTML = '';

  if (!finalizados.length) {
    lista.innerHTML = '<div class="vazio-fin">Nenhum pedido finalizado nesse dia ainda.</div>';
  }

  let totalDia = 0;
  finalizados.forEach(f => {
    totalDia += f.total;
    const hora = new Date(f.finalizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const resumoItens = f.itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ');
    const div = document.createElement('div');
    div.className = 'linha-finalizado';
    div.innerHTML = `
      <div class="topo-fin">
        <div>
          <span class="titulo-fin">${f.tipo === 'mesa' ? 'Mesa ' + f.numero : 'Pedido ' + f.numero}</span>
          <span class="hora-fin"> · ${hora}${f.comanda ? ' · Comanda ' + f.comanda : ''}</span>
        </div>
        <span class="total-fin">${formatarReais(f.total)}</span>
      </div>
      <div class="itens-fin">${resumoItens}</div>
      <button class="btn-icone excluir" title="Remover do histórico">🗑️</button>
    `;
    div.querySelector('.excluir').addEventListener('click', async () => {
      await fetch(`${API}/finalizados/${f._id}`, { method: 'DELETE' });
      carregarFinalizados();
    });
    lista.appendChild(div);
  });

  document.getElementById('total-caixa').textContent = formatarReais(totalDia);
}

document.getElementById('btn-fechar-caixa').addEventListener('click', () => {
  const total = document.getElementById('total-caixa').textContent;
  const data = inputDataFinalizados.value || hojeISO();
  document.getElementById('confirmacao-texto').innerHTML =
    `Fechar o caixa do dia <b>${data.split('-').reverse().join('/')}</b>?<br>Total: <b>${total}</b><br><br>` +
    `Isso vai apagar os pedidos desse dia do histórico de "Finalizados".`;
  modalConfirmacao.classList.remove('escondida');
  modalConfirmacao.dataset.acao = 'fechar-caixa';
});

// intercepta o botao "Sim" do modal de confirmacao generico pra tratar tanto
// o finalizar pedido quanto o fechar caixa, dependendo de qual acao foi armada
document.getElementById('confirmacao-sim').addEventListener('click', async () => {
  if (modalConfirmacao.dataset.acao !== 'fechar-caixa') return;
  const data = inputDataFinalizados.value || hojeISO();
  await fetch(`${API}/finalizados?data=${data}`, { method: 'DELETE' });
  await fetch(`${API}/outros/reiniciar-numeracao`, { method: 'POST' });
  modalConfirmacao.classList.add('escondida');
  modalConfirmacao.dataset.acao = '';
  carregarFinalizados();
});
