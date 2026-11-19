export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  deviceToken?: string,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body === undefined || body instanceof FormData
        ? {}
        : { "content-type": "application/json" }),
      ...(deviceToken ? { authorization: `Bearer ${deviceToken}` } : {}),
    },
    body:
      body === undefined || body instanceof FormData
        ? body
        : JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      result?.message || "Serviço indisponível. Tente novamente.",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function message(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível concluir. Verifique a conexão e tente novamente.";
}
