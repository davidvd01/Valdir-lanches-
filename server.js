require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const Item = require('./models/Item');
const Pedido = require('./models/Pedido');
const Finalizado = require('./models/Finalizado');
const Cozinha = require('./models/Cozinha');
const cardapio = require('./cardapio');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// O servidor (Render) roda em UTC, mas a lanchonete opera no horario de Brasilia
// (UTC-3, sem horario de verao atualmente). Sem isso, pedidos finalizados depois
// das 21h (horario local) ficavam registrados no dia UTC seguinte e sumiam da
// aba "Finalizados" do dia certo. Essas funcoes calculam os limites do dia
// sempre com base no horario de Brasilia, nao no horario interno do servidor.
const OFFSET_BRASIL_HORAS = 3; // Brasilia = UTC-3

function limitesDoDiaBrasil(dataStr) {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, dia, OFFSET_BRASIL_HORAS, 0, 0, 0));
  const fim = new Date(inicio.getTime() + 24 * 3600000 - 1);
  return { inicio, fim };
}

function hojeStrBrasil() {
  const agora = new Date();
  const comoLocal = new Date(agora.getTime() - OFFSET_BRASIL_HORAS * 3600000);
  const ano = comoLocal.getUTCFullYear();
  const mes = String(comoLocal.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(comoLocal.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Conectado ao MongoDB'))
  .catch(err => console.error('Erro ao conectar no MongoDB:', err));

// Garante que existam as 9 mesas iniciais e o item "Diversos"
async function garantirDadosIniciais() {
  const totalMesas = await Pedido.countDocuments({ tipo: 'mesa' });
  if (totalMesas === 0) {
    const mesas = [];
    for (let i = 1; i <= 9; i++) {
      mesas.push({ tipo: 'mesa', numero: i, comanda: '', itens: [] });
    }
    await Pedido.insertMany(mesas);
    console.log('9 mesas iniciais criadas');
  }

  const diversos = await Item.findOne({ diverso: true });
  if (!diversos) {
    await Item.create({ nome: 'Diversos', preco: 0, categoria: 'Outros', diverso: true });
    console.log('Item "Diversos" criado');
  }
}
garantirDadosIniciais();

// Rota especial pra cadastrar o cardápio inteiro de uma vez, abrindo esse
// link uma unica vez no navegador (depois pode esquecer que ela existe):
// https://SEU-LINK.onrender.com/api/cadastrar-cardapio?chave=valdir123
app.get('/api/cadastrar-cardapio', async (req, res) => {
  const chave = req.query.chave;
  if (chave !== 'valdir123') {
    return res.status(403).send('Chave incorreta.');
  }
  try {
    await Item.deleteMany({});
    await Item.insertMany(cardapio);
    res.send(`Cardápio cadastrado com sucesso! ${cardapio.length} itens no banco.`);
  } catch (err) {
    res.status(500).send('Erro ao cadastrar: ' + err.message);
  }
});

// ---------- ITENS DO CARDAPIO ----------

// Busca itens (autocompletar). Ex: GET /api/itens?busca=x cala
app.get('/api/itens', async (req, res) => {
  try {
    const busca = (req.query.busca || '').trim();
    let filtro = {};
    if (busca) {
      filtro = { nome: { $regex: busca, $options: 'i' } };
    }
    const itens = await Item.find(filtro).sort({ nome: 1 }).limit(20);
    res.json(itens);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Cadastrar novo item no cardapio
app.post('/api/itens', async (req, res) => {
  try {
    const { nome, preco, categoria } = req.body;
    const item = await Item.create({ nome, preco, categoria });
    res.json(item);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Listar todos os itens do cardapio (pra tela de gerenciar o cardapio)
app.get('/api/itens/todos', async (req, res) => {
  const itens = await Item.find().sort({ categoria: 1, nome: 1 });
  res.json(itens);
});

// Editar item do cardapio (nome, preco ou categoria)
app.put('/api/itens/:id', async (req, res) => {
  try {
    const { nome, preco, categoria } = req.body;
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { nome, preco, categoria },
      { new: true }
    );
    res.json(item);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Apagar item do cardapio
app.delete('/api/itens/:id', async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ---------- MESAS ----------

app.get('/api/mesas', async (req, res) => {
  const mesas = await Pedido.find({ tipo: 'mesa' }).sort({ numero: 1 });
  res.json(mesas);
});

// Adicionar nova mesa (proximo numero disponivel)
app.post('/api/mesas', async (req, res) => {
  const ultima = await Pedido.find({ tipo: 'mesa' }).sort({ numero: -1 }).limit(1);
  const proximoNumero = ultima.length ? ultima[0].numero + 1 : 1;
  const mesa = await Pedido.create({ tipo: 'mesa', numero: proximoNumero, comanda: '', itens: [] });
  res.json(mesa);
});

// Associar numero da comanda a uma mesa
app.put('/api/mesas/:id/comanda', async (req, res) => {
  const { comanda } = req.body;
  const mesa = await Pedido.findByIdAndUpdate(req.params.id, { comanda }, { new: true });
  res.json(mesa);
});

// ---------- OUTROS (pedidos avulsos, sem mesa) ----------

app.get('/api/outros', async (req, res) => {
  const pedidos = await Pedido.find({ tipo: 'outros', aberta: true }).sort({ numero: 1 });
  res.json(pedidos);
});

app.post('/api/outros', async (req, res) => {
  const { inicio: inicioHoje } = limitesDoDiaBrasil(hojeStrBrasil());
  const ultimo = await Pedido.find({ tipo: 'outros', createdAt: { $gte: inicioHoje } })
    .sort({ numero: -1 }).limit(1);
  const proximoNumero = ultimo.length ? ultimo[0].numero + 1 : 1;
  const pedido = await Pedido.create({ tipo: 'outros', numero: proximoNumero, comanda: '', itens: [] });
  res.json(pedido);
});

// Apaga uma mesa ou um pedido de "Outros" inteiro (usado pela lixeira no card)
app.delete('/api/pedidos/:id', async (req, res) => {
  try {
    await Pedido.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Transfere todos os itens (e a comanda) de um pedido pra outro.
// Funciona entre mesas, entre "outros", ou entre mesa <-> outros.
// A origem fica limpa (mesa some vazia; "outros" e apagado, ja que nao serve mais).
app.post('/api/pedidos/:id/transferir', async (req, res) => {
  try {
    const { destinoId } = req.body;
    const origem = await Pedido.findById(req.params.id);
    const destino = await Pedido.findById(destinoId);
    if (!origem || !destino) return res.status(404).json({ erro: 'Pedido nao encontrado' });

    destino.itens = destino.itens.concat(origem.itens);
    if (origem.comanda && !destino.comanda) destino.comanda = origem.comanda;
    await destino.save();

    if (origem.tipo === 'mesa') {
      origem.itens = [];
      origem.comanda = '';
      await origem.save();
    } else {
      await origem.deleteOne();
    }

    res.json({ ok: true, destino });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ---------- COZINHA ----------

// Envia itens selecionados pra tela da cozinha
app.post('/api/cozinha', async (req, res) => {
  try {
    const { tipo, numero, comanda, itens } = req.body;
    const ticket = await Cozinha.create({ tipo, numero, comanda, itens });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Lista os tickets pendentes da cozinha
app.get('/api/cozinha', async (req, res) => {
  const tickets = await Cozinha.find().sort({ createdAt: 1 });
  res.json(tickets);
});

// Marca como pronto / remove o ticket da cozinha
app.delete('/api/cozinha/:id', async (req, res) => {
  try {
    await Cozinha.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ---------- ITENS DENTRO DE UM PEDIDO (mesa ou outros) ----------

// Adicionar item ao pedido
app.post('/api/pedidos/:id/itens', async (req, res) => {
  try {
    const { nome, preco, quantidade, observacao } = req.body;
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado' });
    pedido.itens.push({ nome, preco, quantidade: quantidade || 1, observacao: observacao || '' });
    await pedido.save();
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Alterar item (quantidade e/ou preco - usado no lapis de editar, inclusive para "Diversos")
app.put('/api/pedidos/:pedidoId/itens/:itemId', async (req, res) => {
  try {
    const { quantidade, preco, nome, observacao } = req.body;
    const pedido = await Pedido.findById(req.params.pedidoId);
    if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado' });
    const item = pedido.itens.id(req.params.itemId);
    if (!item) return res.status(404).json({ erro: 'Item nao encontrado' });
    if (quantidade !== undefined) item.quantidade = quantidade;
    if (preco !== undefined) item.preco = preco;
    if (nome !== undefined) item.nome = nome;
    if (observacao !== undefined) item.observacao = observacao;
    await pedido.save();
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Remover item do pedido
app.delete('/api/pedidos/:pedidoId/itens/:itemId', async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.pedidoId);
    if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado' });
    pedido.itens.id(req.params.itemId).deleteOne();
    await pedido.save();
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Finalizar conta: mesa -> limpa itens e comanda (fica disponivel); outros -> remove da lista
// Antes disso, guarda uma copia no historico de "Finalizados" (pra fechamento de caixa do dia)
app.post('/api/pedidos/:id/finalizar', async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado' });

    if (pedido.itens.length > 0) {
      const total = pedido.itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
      await Finalizado.create({
        tipo: pedido.tipo,
        numero: pedido.numero,
        comanda: pedido.comanda,
        itens: pedido.itens.map(i => ({
          nome: i.nome, preco: i.preco, quantidade: i.quantidade, observacao: i.observacao
        })),
        total
      });
    }

    if (pedido.tipo === 'mesa') {
      pedido.itens = [];
      pedido.comanda = '';
      await pedido.save();
      return res.json(pedido);
    } else {
      await pedido.deleteOne();
      return res.json({ ok: true });
    }
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ---------- FINALIZADOS (historico do dia / fechamento de caixa) ----------

// Lista os finalizados de um dia (padrao: hoje). Use ?data=YYYY-MM-DD
app.get('/api/finalizados', async (req, res) => {
  try {
    const dataParam = req.query.data || hojeStrBrasil();
    const { inicio, fim } = limitesDoDiaBrasil(dataParam);

    const finalizados = await Finalizado.find({
      finalizadoEm: { $gte: inicio, $lte: fim }
    }).sort({ finalizadoEm: -1 });

    res.json(finalizados);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Remove um item do historico (limpar um registro especifico)
app.delete('/api/finalizados/:id', async (req, res) => {
  try {
    await Finalizado.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Limpa todo o historico de um dia (usado depois de fechar o caixa, se quiser)
app.delete('/api/finalizados', async (req, res) => {
  try {
    const dataParam = req.query.data;
    if (!dataParam) return res.status(400).json({ erro: 'Informe a data' });
    const { inicio, fim } = limitesDoDiaBrasil(dataParam);
    await Finalizado.deleteMany({ finalizadoEm: { $gte: inicio, $lte: fim } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Reseta a numeracao de "Outros": apaga os pedidos avulsos vazios (sem itens)
// pra que o proximo pedido criado volte a comecar do numero 1.
// Pedidos com itens dentro sao preservados, pra nao perder nada em aberto.
app.post('/api/outros/reiniciar-numeracao', async (req, res) => {
  try {
    await Pedido.deleteMany({ tipo: 'outros', itens: { $size: 0 } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.listen(PORT, () => console.log(`Valdir Lanches rodando na porta ${PORT}`));
