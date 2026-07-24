import "dotenv/config";
import { defineConfig } from "prisma/config";

// Configuração usada pelos comandos do Prisma CLI. O schema define o modelo,
// migrations guardam a evolução do banco e DATABASE_URL aponta para PostgreSQL.
export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    // `prisma generate` nao acessa o banco e precisa funcionar durante o build
    // Docker, antes de segredos de runtime serem disponibilizados. Comandos que
    // realmente usam o datasource continuam falhando se a URL estiver ausente.
    url: process.env.DATABASE_URL!,
  },
});
