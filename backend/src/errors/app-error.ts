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
