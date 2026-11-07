import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../../shared/http-error';
import type { Role, User } from '../users/users.model';
import { usersRepository } from '../users/users.repository';
import { verifyToken } from './token';

/**
 * Valida el JWT y carga el usuario desde la base. El rol que vale es el de la
 * base, no el del token: si el administrador cambia el rol o desactiva la
 * cuenta, el cambio se aplica en el próximo pedido.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('TOKEN_MISSING', 'Falta el token de sesión.');
  }

  const claims = verifyToken(header.slice('Bearer '.length));
  if (!claims) {
    throw unauthorized('TOKEN_INVALID', 'La sesión no es válida o venció. Ingresá de nuevo.');
  }

  const user = usersRepository.findById(claims.sub);
  if (!user || !user.active) {
    throw unauthorized('ACCOUNT_INACTIVE', 'La cuenta no existe o está desactivada.');
  }

  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = currentUser(req);
    if (!roles.includes(user.role)) {
      throw forbidden('ROLE_FORBIDDEN', `Esta acción requiere rol ${roles.join(' o ')}.`);
    }
    next();
  };
}

/** Usuario autenticado del pedido. Solo se usa detrás de `requireAuth`. */
export function currentUser(req: Request): User {
  if (!req.user) {
    throw unauthorized('TOKEN_MISSING', 'Falta el token de sesión.');
  }
  return req.user;
}
