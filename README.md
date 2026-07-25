# Valdir Lanches — Sistema de Comandas Eletrônicas

Sistema web (sem app) de lançamento de pedidos por mesa e fechamento de conta,
usando o número da comanda eletrônica como identificador.

## O que já está pronto nessa primeira versão

- Menu lateral com **Mesas** (grade 3x3, com botão pra adicionar mais mesas) e
  **Outros** (pedidos avulsos, sem mesa).
- Cada mesa/pedido mostra número, comanda associada e valor total.
- Tela de pedido com busca e autopreenchimento dos itens do cardápio.
- Item **"Diversos"** com preço livre, pra digitar na hora.
- Botão de lápis pra alterar quantidade/preço de um item já lançado.
- **Finalizar conta** com confirmação — limpa a mesa ou remove da lista de "Outros".
- Cardápio já cadastrado no banco (todos os lanches, sucos e bebidas das fotos que você mandou).

## Como subir isso pro ar (mesmo passo a passo do sistema da produção)

### 1. Banco de dados (MongoDB Atlas)
Se você já tem o cluster gratuito criado pro sistema de produção, pode usar o
**mesmo cluster** — só criar um banco novo dentro dele (ex: `valdir-lanches`).
Se for criar do zero: [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) →
criar cluster gratuito (M0) → criar usuário/senha → liberar acesso de qualquer IP
(0.0.0.0/0) → copiar a "connection string".

### 2. Subir o código pro GitHub
1. Crie um repositório novo (ex: `valdir-lanches`) na sua conta pessoal do GitHub.
2. Suba todos os arquivos desta pasta pra dentro dele (pelo site do GitHub mesmo,
   arrastando os arquivos, ou por linha de comando se preferir).

### 3. Deploy no Render
1. Em [render.com](https://render.com), com seu e-mail pessoal: **New +** → **Web Service**.
2. Conecte o repositório `valdir-lanches`.
3. Configurações:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Em **Environment**, adicione a variável:
   - `MONGODB_URI` = a connection string do MongoDB Atlas (trocando `<password>`
     pela senha real e apontando pro banco `valdir-lanches`)
5. Clique em **Create Web Service**. O Render vai te dar um link tipo
   `https://valdir-lanches.onrender.com` — esse é o link que você acessa do
   celular ou do tablet.

### 4. Cadastrar o cardápio no banco
Isso só precisa ser feito **uma vez**. Depois do primeiro deploy funcionando:
- Rode `npm run seed` (localmente, apontando pro mesmo `MONGODB_URI` do Render,
  num arquivo `.env` que você cria copiando o `.env.example`) — isso cadastra
  todos os itens do cardápio no banco.
- Se preferir, me chama que eu te ajudo a rodar isso quando chegar a hora.

Depois disso o sistema já abre com as 9 mesas vazias e o cardápio completo
pronto pra buscar.

## Próximos passos (quando você quiser)
- Trocar o `prompt()` de digitar a comanda por leitura de verdade pela câmera
  (como conversamos, usando a câmera do celular/tablet pra ler o código de
  barras da comanda física).
- Categorias/abas dentro da busca (hambúrguer, frango, bebidas etc.).
- Relatório de vendas do dia.
