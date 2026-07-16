import express from "express"
import cors from "cors"
import clientesRoutes from "./routes/clientes.routes.js"
import ordensRoutes from "./routes/ordens.routes.js"
import { errorMiddleware } from "./middlewares/error.middleware.js"



const app = express()

app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
  res.json({
    mensagem: "API do Servix funcionando"
  })
})

//testye 
import type { Request, Response } from "express"
import { prisma } from "./lib/prisma.js"

app.get("/teste-banco", async (_req: Request, res: Response) => {
  try {
    const empresas = await prisma.empresa.findMany()

    return res.json({
      sucesso: true,
      mensagem: "Banco conectado corretamente",
      empresas
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao acessar o banco"
    })
  }
})

app.use("/clientes", clientesRoutes)
app.use("/ordens", ordensRoutes)

app.use((req, res) => {
  res.status(404).json({
    erro: "Rota não encontrada"
  })
})

app.use(errorMiddleware)

export default app
