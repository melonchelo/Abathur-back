import type { Role, User } from '../users/users.model';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

/** Lo que viaja dentro del JWT. */
export interface TokenClaims {
  sub: string;
  username: string;
  role: Role;
}
