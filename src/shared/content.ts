import { badRequest } from './http-error';
import {
  optionalObjectList,
  optionalStringList,
  readBody,
  requiredString,
  type UnknownBody,
} from './validation';

export interface Source {
  title: string;
  url: string;
}

/** Contenido tipado de un artículo. Lo usan el alta de artículo y las propuestas. */
export interface ProposedArticle {
  title: string;
  summary: string;
  /** Markdown: `#`, `##`, párrafos y listas con `-`. Sin HTML. */
  content: string;
  categoryId: string;
  tags: readonly string[];
  sources: readonly Source[];
}

const HTML_TAG = /<\/?[a-zA-Z][\w-]*(\s[^<>]*)?\/?>|<!--/;
const MAX_CONTENT_LENGTH = 50_000;

export function containsHtml(text: string): boolean {
  return HTML_TAG.test(text);
}

/** Valida el Markdown y lo devuelve igual a como llegó. */
export function requiredMarkdown(body: UnknownBody, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest('INVALID_FIELD', `El campo "${field}" es obligatorio y tiene que ser texto Markdown.`);
  }
  if (value.length > MAX_CONTENT_LENGTH) {
    throw badRequest('INVALID_FIELD', `El campo "${field}" no puede superar los ${MAX_CONTENT_LENGTH} caracteres.`);
  }
  if (containsHtml(value)) {
    throw badRequest(
      'HTML_NOT_ALLOWED',
      `El campo "${field}" trae una etiqueta HTML. Solo se admite Markdown: #, ##, párrafos y listas con "-".`,
    );
  }
  return value;
}

function readSource(item: UnknownBody): Source {
  const title = requiredString(item, 'title', 200);
  const url = requiredString(item, 'url', 2000);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw badRequest('INVALID_FIELD', `La fuente "${title}" no tiene una URL válida.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw badRequest('INVALID_FIELD', `La fuente "${title}" tiene que usar http o https.`);
  }
  return { title, url };
}

export function readProposedArticle(value: unknown): ProposedArticle {
  const body = readBody(value, 'El contenido propuesto');
  return {
    title: requiredString(body, 'title', 200),
    summary: requiredString(body, 'summary', 500),
    content: requiredMarkdown(body, 'content'),
    categoryId: requiredString(body, 'categoryId', 100),
    tags: optionalStringList(body, 'tags', 20, 40),
    sources: optionalObjectList(body, 'sources', 20).map(readSource),
  };
}

// Columnas JSON de SQLite (tags y sources)

export function parseTags(text: string): string[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value)) return [];
  const items: readonly unknown[] = value;
  return items.filter((item): item is string => typeof item === 'string');
}

export function parseSources(text: string): Source[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value)) return [];
  const items: readonly unknown[] = value;
  const sources: Source[] = [];
  for (const item of items) {
    if (typeof item === 'object' && item !== null && 'title' in item && 'url' in item) {
      const { title, url } = item;
      if (typeof title === 'string' && typeof url === 'string') sources.push({ title, url });
    }
  }
  return sources;
}
