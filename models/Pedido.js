const mongoose = require('mongoose');

const ItemPedidoSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  preco: { type: Number, required: true },
  quantidade: { type: Number, required: true, default: 1 },
  observacao: { type: String, default: '' }
}, { _id: true });

const PedidoSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['mesa', 'outros'], required: true },
  numero: { type: Number, required: true }, // numero da mesa, ou numero sequencial em "outros"
  comanda: { type: String, default: '' }, // numero do codigo de barras da comanda eletronica
  itens: { type: [ItemPedidoSchema], default: [] },
  aberta: { type: Boolean, default: true } // false = conta encerrada (usado em "outros" antes de remover)
}, { timestamps: true });

PedidoSchema.virtual('total').get(function () {
  return this.itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0);
});
PedidoSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Pedido', PedidoSchema);
