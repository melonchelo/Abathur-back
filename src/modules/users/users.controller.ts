import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { config } from '../../config';
import { inTransaction } from '../../db/connection';
import { badRequest, conflict, notFound } from '../../shared/http-error';
import { newId, nowIso } from '../../shared/ids';
import {
  optionalBoolean,
  optionalEnum,
  optionalString,
  readBody,
  requiredEnum,
  requiredInteger,
  requiredString,
} from '../../shared/validation';
import { auditRepository } from '../audit/audit.repository';
import { currentUser } from '../auth/auth.middleware';
import { REPUTATION_DELTA } from '../reputation/reputation.model';
import { reputationRepository } from '../reputation/reputation.repository';
import {
  ROLES,
  type CreateUserRequest,
  type SanctionRequest,
  type SanctionResult,
  type UpdateUserRequest,
  type User,
} from './users.model';
import { usersRepository } from './users.repository';

function readCreateUserRequest(value: unknown): CreateUserRequest {
  const body = readBody(value);
  const password = optionalString(body, 'password', 200);
  if (password && password.length < 6) {
    throw badRequest('INVALID_FIELD', 'La contraseña tiene que tener al menos 6 caracteres.');
  }
  const username = requiredString(body, 'username', 50);
  if (!/^[a-z0-9._-]+$/i.test(username)) {
    throw badRequest('INVALID_FIELD', 'El usuario solo admite letras, números, punto, guion y guion bajo.');
  }
  return {
    alias: requiredString(body, 'alias', 80),
    username,
    role: requiredEnum(body, 'role', ROLES),
    initialReputation: requiredInteger(body, 'initialReputation', 0, 1000),
    password: password ?? undefined,
  };
}

function readUpdateUserRequest(value: unknown): UpdateUserRequest {
  const body = readBody(value);
  const request: UpdateUserRequest = {
    role: optionalEnum(body, 'role', ROLES),
    active: optionalBoolean(body, 'active'),
    reason: optionalString(body, 'reason', 1000),
  };
  if (request.role === undefined && request.active === undefined) {
    throw badRequest('EMPTY_UPDATE', 'Indicá un rol nuevo o el estado activo.');
  }
  return request;
}

function readSanctionRequest(value: unknown): SanctionRequest {
  const body = readBody(value);
  return { reason: requiredString(body, 'reason', 1000) };
}

function findUserOr404(id: string): User {
  const user = usersRepository.findById(id);
  if (!user) throw notFound('USER_NOT_FOUND', 'La persona no existe.');
  return user;
}

export const usersController = {
  /** GET /users */
  list(_req: Request, res: Response<User[]>): void {
    res.json(usersRepository.findAll());
  },

  /** GET /users/:id */
  getById(req: Request<{ id: string }>, res: Response<User>): void {
    res.json(findUserOr404(req.params.id));
  },

  /** POST /users · solo admin. Crea la cuenta y su evento `asignacion_inicial`. */
  create(req: Request, res: Response<User>): void {
    const admin = currentUser(req);
    const request = readCreateUserRequest(req.body);
    if (usersRepository.usernameExists(request.username)) {
      throw conflict('USERNAME_TAKEN', `El usuario "${request.username}" ya existe.`);
    }

    const userId = newId();
    const createdAt = nowIso();
    inTransaction(() => {
      usersRepository.insert({
        id: userId,
        username: request.username,
        alias: request.alias,
        role: request.role,
        passwordHash: bcrypt.hashSync(request.password ?? config.defaultPassword, 10),
        createdAt,
      });
      reputationRepository.insert({
        id: newId(),
        userId,
        eventType: 'asignacion_inicial',
        sourceId: userId,
        delta: request.initialReputation,
        createdAt,
      });
      auditRepository.insert({
        id: newId(),
        actorId: admin.id,
        action: 'alta_usuario',
        entityType: 'user',
        entityId: userId,
        reason: null,
        decisionKind: null,
        createdAt,
      });
    });

    res.status(201).json(findUserOr404(userId));
  },

  /** PATCH /users/:id · solo admin. Cambia el rol o desactiva. No borra historia. */
  update(req: Request<{ id: string }>, res: Response<User>): void {
    const admin = currentUser(req);
    const target = findUserOr404(req.params.id);
    const request = readUpdateUserRequest(req.body);

    if (target.id === admin.id) {
      throw conflict('SELF_UPDATE_FORBIDDEN', 'No podés cambiar tu propio rol ni desactivar tu cuenta.');
    }

    inTransaction(() => {
      usersRepository.update(target.id, { role: request.role, active: request.active });
      auditRepository.insert({
        id: newId(),
        actorId: admin.id,
        action: 'cambio_usuario',
        entityType: 'user',
        entityId: target.id,
        reason: request.reason ?? null,
        decisionKind: null,
        createdAt: nowIso(),
      });
    });

    res.json(findUserOr404(target.id));
  },

  /**
   * POST /users/:id/sanctions · solo admin. Es solo el evento manual `conducta_abusiva`:
   * primero la auditoría y después el evento, con el id de esa auditoría como `source_id`.
   */
  sanction(req: Request<{ id: string }>, res: Response<SanctionResult>): void {
    const admin = currentUser(req);
    const target = findUserOr404(req.params.id);
    const { reason } = readSanctionRequest(req.body);

    if (target.id === admin.id) {
      throw conflict('SELF_SANCTION_FORBIDDEN', 'No podés aplicarte una conducta abusiva a vos.');
    }

    const createdAt = nowIso();
    const result = inTransaction(() => {
      const audit = auditRepository.insert({
        id: newId(),
        actorId: admin.id,
        action: 'conducta_abusiva',
        entityType: 'user',
        entityId: target.id,
        reason,
        decisionKind: null,
        createdAt,
      });
      const event = reputationRepository.insert({
        id: newId(),
        userId: target.id,
        eventType: 'conducta_abusiva',
        sourceId: audit.id,
        delta: REPUTATION_DELTA.conducta_abusiva,
        createdAt,
      });
      return { audit, event };
    });

    res.status(201).json({ user: findUserOr404(target.id), ...result });
  },
};
