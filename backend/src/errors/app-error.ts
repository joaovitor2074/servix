// Representa um erro esperado da aplicação. O middleware global usa esses
// campos para responder ao cliente sem transformar uma regra de negócio em 500.
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly codigo: string,
    public readonly detalhes?: unknown
  ) {
    super(message)
    this.name = "AppError"
  }
}
