import { config } from "dotenv"

// `.env.local` aparece primeiro e pode sobrescrever valores locais sem que
// credenciais pessoais sejam adicionadas ao repositório.
config({
  path: [".env.network.local", ".env.local", ".env"],
  quiet: true
})
