import express from "express"
import cors from "cors"
import clientesRoutes from "./routes/clientes.routes.js"

const app = express()

app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
  res.json({
    mensagem: "API do Servix funcionando"
  })
})

app.use("/clientes", clientesRoutes)

app.use((req, res) => {
  res.status(404).json({
    erro: "Rota não encontrada"
  })
})

export default app