const mongoose = require('mongoose');

const ItemCozinhaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  observacao: { type: String, default: '' }
}, { _id: false });

const CozinhaSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['mesa', 'outros'], required: true },
  numero: { type: Number, required: true },
  comanda: { type: String, default: '' },
  itens: { type: [ItemCozinhaSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Cozinha', CozinhaSchema);
