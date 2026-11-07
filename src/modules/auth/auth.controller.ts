import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { forbidden, unauthorized } from '../../shared/http-error';
import { readBody, requiredString } from '../../shared/validation';
import type { User } from '../users/users.model';
import { usersRepository } from '../users/users.repository';
import type { LoginRequest, LoginResponse } from './auth.model';
import { currentUser } from './auth.middleware';
import { signToken } from './token';

function readLoginRequest(value: unknown): LoginRequest {
  const body = readBody(value);
  return {
    username: requiredString(body, 'username', 100),
    password: requiredString(body, 'password', 200),
  };
}

export const authController = {
  /** POST /auth/login */
  login(req: Request, res: Response<LoginResponse>): void {
    const { username, password } = readLoginRequest(req.body);

    const credentials = usersRepository.findCredentials(username);
    if (!credentials || !bcrypt.compareSync(password, credentials.passwordHash)) {
      throw unauthorized('INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
    }
    if (!credentials.user.active) {
      throw forbidden('ACCOUNT_INACTIVE', 'La cuenta está desactivada.');
    }

    res.json({ token: signToken(credentials.user), user: credentials.user });
  },

  /** GET /me */
  me(req: Request, res: Response<User>): void {
    res.json(currentUser(req));
  },
};
