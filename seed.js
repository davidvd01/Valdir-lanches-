// Cadastra todo o cardapio digitalizado das fotos no banco.
// Rodar com: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./models/Item');
const itens = require('./cardapio');

async function rodarSeed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado ao MongoDB, limpando itens antigos...');
  await Item.deleteMany({});
  await Item.insertMany(itens);
  console.log(`${itens.length} itens cadastrados com sucesso!`);
  await mongoose.disconnect();
}

rodarSeed().catch(err => {
  console.error('Erro ao rodar seed:', err);
  process.exit(1);
});
