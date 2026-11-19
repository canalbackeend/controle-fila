export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function missing(message = "Registro não encontrado."): never {
  throw new HttpError(404, message);
}
