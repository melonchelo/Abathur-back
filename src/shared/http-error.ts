/** Forma única de todo error que devuelve la API. */
export interface ApiError {
  code: string;
  message: string;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  toJSON(): ApiError {
    return { code: this.code, message: this.message };
  }
}

export const badRequest = (code: string, message: string): HttpError => new HttpError(400, code, message);
export const unauthorized = (code: string, message: string): HttpError => new HttpError(401, code, message);
export const forbidden = (code: string, message: string): HttpError => new HttpError(403, code, message);
export const notFound = (code: string, message: string): HttpError => new HttpError(404, code, message);
export const conflict = (code: string, message: string): HttpError => new HttpError(409, code, message);
