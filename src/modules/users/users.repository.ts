import { db } from '../../db/connection';
import type { Role, User } from './users.model';

interface UserRow {
  id: string;
  username: string;
  alias: string;
  role: Role;
  active: 0 | 1;
  reputation: number;
  created_at: string;
}

interface CredentialsRow extends UserRow {
  password_hash: string;
}

export interface NewUserRow {
  id: string;
  username: string;
  alias: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
}

const SELECT_USER = `
  SELECT u.id, u.username, u.alias, u.role, u.active, u.created_at, u.password_hash,
         COALESCE((SELECT SUM(e.delta) FROM reputation_events e WHERE e.user_id = u.id), 0) AS reputation
  FROM users u`;

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    alias: row.alias,
    role: row.role,
    active: row.active === 1,
    reputation: row.reputation,
    createdAt: row.created_at,
  };
}

export const usersRepository = {
  findAll(): User[] {
    return db().prepare<[], UserRow>(`${SELECT_USER} ORDER BY u.created_at, u.alias`).all().map(toUser);
  },

  findById(id: string): User | undefined {
    const row = db().prepare<[string], UserRow>(`${SELECT_USER} WHERE u.id = ?`).get(id);
    return row ? toUser(row) : undefined;
  },

  findCredentials(username: string): { user: User; passwordHash: string } | undefined {
    const row = db().prepare<[string], CredentialsRow>(`${SELECT_USER} WHERE u.username = ?`).get(username);
    return row ? { user: toUser(row), passwordHash: row.password_hash } : undefined;
  },

  usernameExists(username: string): boolean {
    return db().prepare<[string], { found: 1 }>('SELECT 1 AS found FROM users WHERE username = ?').get(username) !== undefined;
  },

  insert(user: NewUserRow): void {
    db()
      .prepare(
        `INSERT INTO users (id, username, alias, password_hash, role, active, created_at)
         VALUES (@id, @username, @alias, @passwordHash, @role, 1, @createdAt)`,
      )
      .run(user);
  },

  update(id: string, changes: { role?: Role; active?: boolean }): void {
    if (changes.role !== undefined) {
      db().prepare('UPDATE users SET role = ? WHERE id = ?').run(changes.role, id);
    }
    if (changes.active !== undefined) {
      db().prepare('UPDATE users SET active = ? WHERE id = ?').run(changes.active ? 1 : 0, id);
    }
  },
};
