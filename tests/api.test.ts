import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db/connection';
import { seedDatabase } from '../src/db/seed';

let server: Server;
let baseUrl = '';
const tokens = new Map<string, string>();

interface HttpResult {
  status: number;
  body: unknown;
}

async function call(method: string, path: string, username?: string, payload?: unknown): Promise<HttpResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = username ? tokens.get(username) : undefined;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json() };
}

async function login(username: string): Promise<HttpResult> {
  const result = await call('POST', '/auth/login', undefined, { username, password: 'abathur' });
  const token = field(result.body, 'token');
  if (typeof token === 'string') tokens.set(username, token);
  return result;
}

/** Lee una propiedad de un JSON sin tipar, para las aserciones. */
function field(value: unknown, ...path: (string | number)[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

function list(value: unknown): unknown[] {
  assert.ok(Array.isArray(value), 'se esperaba un arreglo');
  return value;
}

before(async () => {
  openDatabase(':memory:');
  seedDatabase();
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  for (const username of ['lucia', 'tomas', 'sofia', 'raul', 'diego', 'ana', 'martin']) {
    await login(username);
  }
});

after(() => {
  server.close();
});

describe('BE-0 · login, /me y GET', () => {
  it('el JWT trae el rol', async () => {
    const token = tokens.get('tomas') ?? '';
    const payload: unknown = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
    assert.equal(field(payload, 'role'), 'moderador');
  });

  it('credenciales malas responden ApiError', async () => {
    const result = await call('POST', '/auth/login', undefined, { username: 'ana', password: 'otra' });
    assert.equal(result.status, 401);
    assert.equal(field(result.body, 'code'), 'INVALID_CREDENTIALS');
  });

  it('sin token no hay datos', async () => {
    const result = await call('GET', '/articles');
    assert.equal(result.status, 401);
    assert.equal(typeof field(result.body, 'message'), 'string');
  });

  it('/me devuelve el usuario con su reputación', async () => {
    const result = await call('GET', '/me', 'sofia');
    assert.equal(field(result.body, 'alias'), 'Sofía');
    assert.equal(field(result.body, 'reputation'), 30);
  });

  it('underReview sale calculado y la búsqueda no mira el cuerpo', async () => {
    const all = list((await call('GET', '/articles', 'ana')).body);
    const byId = (id: string): unknown => all.find((article) => field(article, 'id') === id);
    assert.equal(field(byId('a-apertura-caja'), 'underReview'), true);
    assert.equal(field(byId('a-acceso-deposito'), 'underReview'), false);

    assert.equal(list((await call('GET', '/articles?q=caja', 'ana')).body).length, 1);
    assert.equal(list((await call('GET', '/articles?q=supervisora', 'ana')).body).length, 1);
    assert.equal(list((await call('GET', '/articles?q=planilla', 'ana')).body).length, 0);
    assert.equal(list((await call('GET', '/articles?categoryId=c-seguridad', 'ana')).body).length, 1);
  });

  it('el detalle trae Markdown con encabezado y el historial dos versiones', async () => {
    const detail = await call('GET', '/articles/a-apertura-caja', 'ana');
    assert.equal(field(detail.body, 'currentVersion', 'versionNumber'), 2);
    assert.match(String(field(detail.body, 'currentVersion', 'content')), /^# /m);
    const versions = list((await call('GET', '/articles/a-cambio-turno/versions', 'ana')).body);
    assert.deepEqual(versions.map((version) => field(version, 'versionNumber')), [2, 1]);
  });

  it('hay una propuesta en cada estado', async () => {
    const statuses = list((await call('GET', '/proposals', 'ana')).body).map((proposal) => field(proposal, 'status'));
    for (const status of ['abierta', 'en_votacion', 'recomendada', 'desaconsejada', 'controvertida', 'aceptada', 'rechazada']) {
      assert.ok(statuses.includes(status), `falta una propuesta ${status}`);
    }
  });

  it('CORS deja pasar a Angular', async () => {
    const response = await fetch(`${baseUrl}/health`, { headers: { Origin: 'http://localhost:4200' } });
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:4200');
  });
});

describe('BE-1 · artículos, categorías, propuestas y comentarios', () => {
  const content = {
    title: 'Cierre de caja',
    summary: 'Cómo cerrar la caja.',
    content: '# Cierre de caja\n\n- Contar el efectivo.\n',
    categoryId: 'c-caja',
    tags: ['caja'],
    sources: [{ title: 'Manual', url: 'https://example.com/manual' }],
  };

  it('el rol se rechaza en el servidor', async () => {
    const result = await call('POST', '/articles', 'ana', content);
    assert.equal(result.status, 403);
    assert.equal(field(result.body, 'code'), 'ROLE_FORBIDDEN');
  });

  it('un cuerpo con HTML no se persiste', async () => {
    const result = await call('POST', '/articles', 'lucia', { ...content, content: '<p>Hola</p>' });
    assert.equal(result.status, 400);
    assert.equal(field(result.body, 'code'), 'HTML_NOT_ALLOWED');
    assert.equal(list((await call('GET', '/articles?q=Cierre de caja', 'lucia')).body).length, 0);
  });

  it('el alta deja la versión 1 como vigente', async () => {
    const result = await call('POST', '/articles', 'lucia', content);
    assert.equal(result.status, 201);
    assert.equal(field(result.body, 'currentVersion', 'versionNumber'), 1);
    assert.equal(field(result.body, 'currentVersionId'), field(result.body, 'currentVersion', 'id'));
    assert.equal(field(result.body, 'currentVersion', 'content'), content.content);
  });

  it('una categoría cíclica responde ApiError', async () => {
    const selfParent = await call('PATCH', '/categories/c-operacion', 'lucia', { parentId: 'c-operacion' });
    assert.equal(field(selfParent.body, 'code'), 'CATEGORY_SELF_PARENT');
    const cycle = await call('PATCH', '/categories/c-operacion', 'lucia', { parentId: 'c-caja' });
    assert.equal(cycle.status, 400);
    assert.equal(field(cycle.body, 'code'), 'CATEGORY_CYCLE');
  });

  it('una modificación queda ligada a la versión de base y no toca el artículo', async () => {
    const created = await call('POST', '/proposals', 'ana', {
      articleId: 'a-acceso-deposito',
      baseVersionId: 'v-acceso-deposito-1',
      proposed: { ...content, title: 'Acceso al depósito', categoryId: 'c-seguridad' },
    });
    assert.equal(created.status, 201);
    assert.equal(field(created.body, 'status'), 'abierta');
    assert.equal(field(created.body, 'kind'), 'modificacion');
    assert.equal(field(created.body, 'baseVersionId'), 'v-acceso-deposito-1');

    const article = await call('GET', '/articles/a-acceso-deposito', 'ana');
    assert.equal(field(article.body, 'currentVersion', 'versionNumber'), 1);
    assert.equal(field(article.body, 'underReview'), true);
  });

  it('el administrador no propone y el cliente no abre votación', async () => {
    assert.equal((await call('POST', '/proposals', 'lucia', { proposed: content })).status, 403);
    assert.equal((await call('POST', '/proposals/p-abierta/voting', 'ana')).status, 403);
  });

  it('comentar y abrir la votación', async () => {
    const comment = await call('POST', '/proposals/p-abierta/comments', 'ana', { body: 'Un comentario más' });
    assert.equal(comment.status, 201);
    assert.equal(field(comment.body, 'authorAlias'), 'Ana');

    const opened = await call('POST', '/proposals/p-abierta/voting', 'tomas');
    assert.equal(field(opened.body, 'status'), 'en_votacion');
  });
});

describe('BE-2 · voto y cierre', () => {
  it('el peso lo calcula el servidor e ignora el del cliente', async () => {
    const result = await call('POST', '/proposals/p-abierta/votes', 'raul', { choice: 'a_favor', weightAtVote: 5 });
    assert.equal(result.status, 201);
    assert.equal(field(result.body, 'weightAtVote'), 1);
  });

  it('el segundo voto del mismo moderador se rechaza', async () => {
    const result = await call('POST', '/proposals/p-abierta/votes', 'raul', { choice: 'en_contra' });
    assert.equal(result.status, 409);
    assert.equal(field(result.body, 'code'), 'ALREADY_VOTED');
  });

  it('el administrador no vota', async () => {
    assert.equal((await call('POST', '/proposals/p-abierta/votes', 'lucia', { choice: 'a_favor' })).status, 403);
  });

  it('cerrar con menos de tres votos falla y la propuesta sigue en votación', async () => {
    const result = await call('POST', '/proposals/p-en-votacion/close', 'tomas');
    assert.equal(result.status, 409);
    assert.equal(field(result.body, 'code'), 'QUORUM_NOT_MET');
    assert.equal(field((await call('GET', '/proposals/p-en-votacion', 'tomas')).body, 'status'), 'en_votacion');
  });

  it('con tres votos queda el resultado comunitario y el artículo igual', async () => {
    const vote = await call('POST', '/proposals/p-en-votacion/votes', 'sofia', { choice: 'a_favor' });
    assert.equal(field(vote.body, 'weightAtVote'), 3);

    const closed = await call('POST', '/proposals/p-en-votacion/close', 'sofia');
    assert.equal(closed.status, 200);
    assert.equal(field(closed.body, 'status'), 'recomendada');
    assert.deepEqual(field(closed.body, 'tally'), { votes: 3, favor: 6, contra: 1, quorum: true });

    const article = await call('GET', '/articles/a-apertura-caja', 'ana');
    assert.equal(field(article.body, 'currentVersion', 'versionNumber'), 2);
  });
});

describe('BE-3 · decisión', () => {
  it('falta el motivo al apartarse y la API lo rechaza', async () => {
    const result = await call('POST', '/proposals/p-recomendada/decision', 'lucia', { outcome: 'rechazar' });
    assert.equal(result.status, 400);
    assert.equal(field(result.body, 'code'), 'REASON_REQUIRED');
  });

  it('falta el motivo en el empate', async () => {
    const result = await call('POST', '/proposals/p-controvertida/decision', 'lucia', { outcome: 'aceptar' });
    assert.equal(field(result.body, 'code'), 'REASON_REQUIRED');
  });

  it('con quórum sin cerrar, primero hay que cerrar', async () => {
    await call('POST', '/proposals/p-abierta/votes', 'tomas', { choice: 'a_favor' });
    await call('POST', '/proposals/p-abierta/votes', 'sofia', { choice: 'en_contra' });
    const result = await call('POST', '/proposals/p-abierta/decision', 'lucia', { outcome: 'aceptar', reason: 'x' });
    assert.equal(result.status, 409);
    assert.equal(field(result.body, 'code'), 'VOTING_NOT_CLOSED');
  });

  it('aceptar crea una versión nueva, conserva la anterior y suma reputación', async () => {
    const result = await call('POST', '/proposals/p-en-votacion/decision', 'lucia', {
      outcome: 'aceptar',
      markBaseAsError: true,
    });
    assert.equal(result.status, 200);
    assert.equal(field(result.body, 'proposal', 'status'), 'aceptada');
    assert.equal(field(result.body, 'proposal', 'decision', 'kind'), 'acorde');
    assert.equal(field(result.body, 'article', 'currentVersion', 'versionNumber'), 3);
    assert.equal(field(result.body, 'audit', 'decisionKind'), 'acorde');

    const events = list(field(result.body, 'reputationEvents'));
    assert.deepEqual(
      events.map((event) => [field(event, 'eventType'), field(event, 'userId'), field(event, 'delta')]),
      [
        ['aporte_respaldado', 'u-martin', 5],
        ['error_comprobado', 'u-ana', -5],
      ],
    );

    const versions = list((await call('GET', '/articles/a-apertura-caja/versions', 'ana')).body);
    assert.deepEqual(versions.map((version) => field(version, 'versionNumber')), [3, 2, 1]);
    assert.equal(field(versions[1], 'isCurrent'), false);

    const article = await call('GET', '/articles/a-apertura-caja', 'ana');
    assert.equal(field(article.body, 'underReview'), true, 'p-abierta sigue pendiente');
  });

  it('la misma propuesta no se decide dos veces', async () => {
    const result = await call('POST', '/proposals/p-en-votacion/decision', 'lucia', { outcome: 'aceptar' });
    assert.equal(field(result.body, 'code'), 'PROPOSAL_ALREADY_DECIDED');
  });

  it('una creación aceptada hace nacer el artículo', async () => {
    const result = await call('POST', '/proposals/p-recomendada/decision', 'lucia', { outcome: 'aceptar' });
    assert.equal(field(result.body, 'article', 'title'), 'Arqueo semanal');
    assert.equal(field(result.body, 'article', 'currentVersion', 'versionNumber'), 1);
  });

  it('sin quórum es excepcional y exige motivo', async () => {
    const created = await call('POST', '/proposals', 'martin', {
      proposed: { title: 'Nueva', summary: 'Resumen', content: '# Nueva\n', categoryId: 'c-caja' },
    });
    const id = String(field(created.body, 'id'));
    const missing = await call('POST', `/proposals/${id}/decision`, 'lucia', { outcome: 'rechazar' });
    assert.equal(field(missing.body, 'code'), 'REASON_REQUIRED');

    const decided = await call('POST', `/proposals/${id}/decision`, 'lucia', { outcome: 'rechazar', reason: 'Duplica otro artículo' });
    assert.equal(field(decided.body, 'proposal', 'decision', 'kind'), 'excepcional');
    assert.deepEqual(field(decided.body, 'reputationEvents'), []);
  });
});

describe('BE-4 · usuarios y auditoría', () => {
  it('el alta deja el evento inicial y el puntaje coincide', async () => {
    const created = await call('POST', '/users', 'lucia', { alias: 'Nora', username: 'nora', role: 'moderador', initialReputation: 40 });
    assert.equal(created.status, 201);
    const id = String(field(created.body, 'id'));
    const reputation = await call('GET', `/users/${id}/reputation`, 'lucia');
    assert.equal(field(reputation.body, 'score'), 40);
    assert.equal(field(reputation.body, 'weight'), 4);
    assert.equal(field(reputation.body, 'events', 0, 'eventType'), 'asignacion_inicial');
    assert.equal(field(reputation.body, 'events', 0, 'sourceId'), id);
  });

  it('un usuario desactivado conserva su historia y no obtiene JWT', async () => {
    const patched = await call('PATCH', '/users/u-raul', 'lucia', { active: false });
    assert.equal(field(patched.body, 'active'), false);

    const loginResult = await call('POST', '/auth/login', undefined, { username: 'raul', password: 'abathur' });
    assert.equal(loginResult.status, 403);
    assert.equal(field(loginResult.body, 'code'), 'ACCOUNT_INACTIVE');

    const oldToken = await call('GET', '/me', 'raul');
    assert.equal(oldToken.status, 401);

    const votes = list((await call('GET', '/proposals/p-recomendada/votes', 'lucia')).body);
    assert.ok(votes.some((vote) => field(vote, 'moderatorId') === 'u-raul'));
  });

  it('dos conductas abusivas generan dos auditorías y dos eventos', async () => {
    const first = await call('POST', '/users/u-martin/sanctions', 'lucia', { reason: 'Insultos en comentarios' });
    const second = await call('POST', '/users/u-martin/sanctions', 'lucia', { reason: 'Reincide' });
    assert.equal(first.status, 201);
    assert.notEqual(field(first.body, 'audit', 'id'), field(second.body, 'audit', 'id'));
    assert.equal(field(first.body, 'event', 'sourceId'), field(first.body, 'audit', 'id'));
    assert.equal(field(second.body, 'event', 'delta'), -8);

    const missingReason = await call('POST', '/users/u-martin/sanctions', 'lucia', {});
    assert.equal(missingReason.status, 400);
  });

  it('la auditoría distingue los tres tipos de decisión y muestra las altas', async () => {
    assert.equal((await call('GET', '/audit', 'ana')).status, 403);
    const entries = list((await call('GET', '/audit', 'lucia')).body);
    const kinds = new Set(entries.map((entry) => field(entry, 'decisionKind')));
    assert.ok(kinds.has('acorde') && kinds.has('apartada') && kinds.has('excepcional'));
    assert.ok(entries.some((entry) => field(entry, 'action') === 'alta_usuario'));
  });
});
