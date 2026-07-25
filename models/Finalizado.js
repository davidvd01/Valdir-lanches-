const mongoose = require('mongoose');

const ItemFinalizadoSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  preco: { type: Number, required: true },
  quantidade: { type: Number, required: true },
  observacao: { type: String, default: '' }
}, { _id: false });

const FinalizadoSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['mesa', 'outros'], required: true },
  numero: { type: Number, required: true },
  comanda: { type: String, default: '' },
  itens: { type: [ItemFinalizadoSchema], default: [] },
  total: { type: Number, required: true },
  finalizadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Finalizado', FinalizadoSchema);
