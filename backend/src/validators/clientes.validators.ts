export function idEhInvalido(id: number): boolean {
  return !Number.isInteger(id) || id <= 0
}
