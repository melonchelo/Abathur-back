import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { ROLES, type User } from '../users/users.model';
import type { TokenClaims } from './auth.model';

export function signToken(user: User): string {
  return jwt.sign({ username: user.username, role: user.role }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresInSeconds,
  });
}

export function verifyToken(token: string): TokenClaims | null {
  let payload: unknown;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
  if (typeof payload !== 'object' || payload === null) return null;
  if (!('sub' in payload) || !('username' in payload) || !('role' in payload)) return null;

  const { sub, username, role } = payload;
  const matchedRole = ROLES.find((option) => option === role);
  if (typeof sub !== 'string' || typeof username !== 'string' || matchedRole === undefined) return null;

  return { sub, username, role: matchedRole };
}
