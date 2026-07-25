require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const Item = require('./models/Item');
const Pedido = require('./models/Pedido');
const cardapio = require('./cardapio');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

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
  const ultimo = await Pedido.find({ tipo: 'outros' }).sort({ numero: -1 }).limit(1);
  const proximoNumero = ultimo.length ? ultimo[0].numero + 1 : 1;
  const pedido = await Pedido.create({ tipo: 'outros', numero: proximoNumero, comanda: '', itens: [] });
  res.json(pedido);
});

// ---------- ITENS DENTRO DE UM PEDIDO (mesa ou outros) ----------

// Adicionar item ao pedido
app.post('/api/pedidos/:id/itens', async (req, res) => {
  try {
    const { nome, preco, quantidade } = req.body;
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado' });
    pedido.itens.push({ nome, preco, quantidade: quantidade || 1 });
    await pedido.save();
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Alterar item (quantidade e/ou preco - usado no lapis de editar, inclusive para "Diversos")
app.put('/api/pedidos/:pedidoId/itens/:itemId', async (req, res) => {
  try {
    const { quantidade, preco } = req.body;
    const pedido = await Pedido.findById(req.params.pedidoId);
    if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado' });
    const item = pedido.itens.id(req.params.itemId);
    if (!item) return res.status(404).json({ erro: 'Item nao encontrado' });
    if (quantidade !== undefined) item.quantidade = quantidade;
    if (preco !== undefined) item.preco = preco;
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
app.post('/api/pedidos/:id/finalizar', async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado' });

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

app.listen(PORT, () => console.log(`Valdir Lanches rodando na porta ${PORT}`));
