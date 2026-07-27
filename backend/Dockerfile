FROM node:24-bookworm-slim

WORKDIR /app

# Prisma detecta o OpenSSL no startup e conexoes HTTPS dependem dos
# certificados raiz. Instalar ambos explicitamente evita fallback de runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

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
