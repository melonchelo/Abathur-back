import type { NextFunction, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { HttpError, type ApiError } from './http-error';

export function notFoundHandler(req: Request, res: Response<ApiError>): void {
  res.status(404).json({ code: 'ROUTE_NOT_FOUND', message: `No existe ${req.method} ${req.originalUrl}.` });
}

export function errorHandler(error: unknown, _req: Request, res: Response<ApiError>, _next: NextFunction): void {
  if (error instanceof HttpError) {
    res.status(error.status).json(error.toJSON());
    return;
  }

  if (error instanceof SyntaxError) {
    res.status(400).json({ code: 'INVALID_JSON', message: 'El cuerpo no es un JSON válido.' });
    return;
  }

  if (error instanceof Database.SqliteError && error.code.startsWith('SQLITE_CONSTRAINT')) {
    res.status(409).json({ code: 'CONSTRAINT_VIOLATION', message: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Error inesperado en el servidor.' });
}
