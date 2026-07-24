FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3005

# Em homologacao, aplicar migrations antes de abrir a API mantem o banco
# alinhado ao artefato publicado. O comando e idempotente para migrations ja
# executadas.
CMD ["sh", "-c", "npm run prisma:migrate:deploy && npm start"]
