FROM node:20

WORKDIR /app

# Copia os arquivos de configuração de pacotes
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o resto do código da aplicação
COPY . .

# Gera os tipos do Prisma (ISSO RESOLVE O SEU ERRO)
RUN npx prisma generate

# Compila o TypeScript (cria a pasta dist)
RUN npm run build

# Expõe a porta que a API vai rodar
EXPOSE 3000

# Em vez de rodar o modo de desenvolvimento (nodemon), roda a versão final em Node puro
CMD ["npm", "start"]