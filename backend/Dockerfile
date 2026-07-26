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

# O comando comum de migrations falha fechado sem SERVIX_FINANCEIRO_MODE=PREVIEW.
# Assim este artefato de homologacao nunca aplica a migration financeira por
# acidente em um ambiente que nao declarou explicitamente a preview.
CMD ["sh", "-c", "npm run prisma:migrate:deploy && npm start"]
