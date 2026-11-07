import { createApp } from './app';
import { config } from './config';
import { openDatabase } from './db/connection';

openDatabase(config.dbPath);

createApp().listen(config.port, () => {
  console.log(`Abathur API en http://localhost:${config.port}/api`);
  console.log(`Base SQLite: ${config.dbPath}`);
});
