import type { AuditEntry } from '../audit/audit.model';
import type { ReputationEvent } from '../reputation/reputation.model';

export type Role = 'admin' | 'moderador' | 'cliente';

export const ROLES: readonly Role[] = ['admin', 'moderador', 'cliente'];

export interface User {
  id: string;
  username: string;
  /** Seudónimo: la identidad visible en la plataforma. */
  alias: string;
  role: Role;
  active: boolean;
  /** Suma de los eventos de reputación. */
  reputation: number;
  createdAt: string;
}

export interface CreateUserRequest {
  alias: string;
  username: string;
  role: Role;
  initialReputation: number;
  /** Opcional. Si no viene, la cuenta arranca con la contraseña de desarrollo. */
  password?: string;
}

export interface UpdateUserRequest {
  role?: Role;
  active?: boolean;
  reason?: string | null;
}

export interface SanctionRequest {
  reason: string;
}

export interface SanctionResult {
  user: User;
  audit: AuditEntry;
  event: ReputationEvent;
}
