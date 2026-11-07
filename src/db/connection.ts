import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createSchema } from './schema';

export type Db = Database.Database;

let instance: Db | null = null;

export function openDatabase(filePath: string): Db {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const database = new Database(filePath);
  database.pragma('foreign_keys = ON');
  createSchema(database);
  instance = database;
  return database;
}

export function db(): Db {
  if (instance === null) {
    throw new Error('La base no está abierta. Llamá a openDatabase() antes de usar los repositorios.');
  }
  return instance;
}

/** Ejecuta `work` dentro de una transacción: si algo lanza, no queda nada escrito. */
export function inTransaction<T>(work: () => T): T {
  return db().transaction(work)();
}
