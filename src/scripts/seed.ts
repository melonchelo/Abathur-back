import fs from 'node:fs';
import { config } from '../config';
import { openDatabase } from '../db/connection';
import { seedDatabase } from '../db/seed';

for (const file of [config.dbPath, `${config.dbPath}-journal`]) {
  fs.rmSync(file, { force: true });
}

const database = openDatabase(config.dbPath);
seedDatabase();

const count = (table: string): number =>
  database.prepare<[], { total: number }>(`SELECT COUNT(*) AS total FROM ${table}`).get()?.total ?? 0;

console.log(`Semilla recreada en ${config.dbPath}`);
for (const table of ['users', 'categories', 'articles', 'article_versions', 'proposals', 'votes', 'comments', 'reputation_events', 'audit_log']) {
  console.log(`  ${table}: ${count(table)}`);
}
console.log(`Contraseña de todas las cuentas: ${config.defaultPassword}`);
database.close();
