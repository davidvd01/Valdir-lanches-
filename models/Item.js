const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  preco: { type: Number, required: true }, // 0 para "Diversos" (preço livre)
  categoria: { type: String, default: '' },
  diverso: { type: Boolean, default: false } // true só para o item "Diversos"
});

module.exports = mongoose.model('Item', ItemSchema);
