import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Configuração usada pelos comandos do Prisma CLI. O schema define o modelo,
// migrations guardam a evolução do banco e DATABASE_URL aponta para PostgreSQL.
export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    url: env("DATABASE_URL"),
  },
});
