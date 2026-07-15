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

app.use("/clientes", clientesRoutes)
app.use("/ordens", ordensRoutes)

app.use((req, res) => {
  res.status(404).json({
    erro: "Rota não encontrada"
  })
})

app.use(errorMiddleware)

export default app
