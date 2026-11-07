import { badRequest } from './http-error';

/**
 * Cuerpo JSON todavía sin validar. Es el único lugar donde aparece un objeto
 * genérico: cada controlador lo estrecha campo por campo a su DTO tipado.
 */
export type UnknownBody = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readBody(value: unknown, what = 'El cuerpo'): UnknownBody {
  if (!isRecord(value)) {
    throw badRequest('INVALID_BODY', `${what} tiene que ser un objeto JSON.`);
  }
  return value;
}

function invalid(field: string, detail: string): never {
  throw badRequest('INVALID_FIELD', `El campo "${field}" ${detail}.`);
}

export function requiredString(body: UnknownBody, field: string, maxLength = 200): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    invalid(field, 'es obligatorio y tiene que ser texto');
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    invalid(field, `no puede superar los ${maxLength} caracteres`);
  }
  return trimmed;
}

/** `undefined` si el campo no vino; `null` si vino vacío o nulo. */
export function optionalString(body: UnknownBody, field: string, maxLength = 200): string | null | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') invalid(field, 'tiene que ser texto');
  const trimmed = value.trim();
  if (trimmed.length > maxLength) invalid(field, `no puede superar los ${maxLength} caracteres`);
  return trimmed === '' ? null : trimmed;
}

export function requiredEnum<T extends string>(body: UnknownBody, field: string, allowed: readonly T[]): T {
  const value = body[field];
  const match = allowed.find((option) => option === value);
  if (match === undefined) {
    invalid(field, `tiene que ser uno de: ${allowed.join(', ')}`);
  }
  return match;
}

export function optionalEnum<T extends string>(body: UnknownBody, field: string, allowed: readonly T[]): T | undefined {
  return body[field] === undefined ? undefined : requiredEnum(body, field, allowed);
}

export function requiredInteger(body: UnknownBody, field: string, min: number, max: number): number {
  const value = body[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    invalid(field, `tiene que ser un entero entre ${min} y ${max}`);
  }
  return value;
}

export function optionalBoolean(body: UnknownBody, field: string): boolean | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') invalid(field, 'tiene que ser true o false');
  return value;
}

export function optionalStringList(body: UnknownBody, field: string, maxItems: number, maxLength: number): string[] {
  const value = body[field];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) invalid(field, 'tiene que ser una lista de textos');
  const items: readonly unknown[] = value;
  if (items.length > maxItems) invalid(field, `admite hasta ${maxItems} elementos`);
  return items.map((item) => {
    if (typeof item !== 'string' || item.trim() === '' || item.trim().length > maxLength) {
      invalid(field, `tiene que contener textos no vacíos de hasta ${maxLength} caracteres`);
    }
    return item.trim();
  });
}

export function optionalObjectList(body: UnknownBody, field: string, maxItems: number): UnknownBody[] {
  const value = body[field];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) invalid(field, 'tiene que ser una lista');
  const items: readonly unknown[] = value;
  if (items.length > maxItems) invalid(field, `admite hasta ${maxItems} elementos`);
  return items.map((item, index) => readBody(item, `El elemento ${index} de "${field}"`));
}

/** Lee un parámetro de query como texto. Devuelve `undefined` si no vino o vino vacío. */
export function queryString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
