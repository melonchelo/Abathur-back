import path from 'node:path';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? path.resolve(__dirname, '..', 'data', 'abathur.sqlite'),
  jwtSecret: process.env.JWT_SECRET ?? 'abathur-dev-secret',
  jwtExpiresInSeconds: 8 * 60 * 60,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
  defaultPassword: 'abathur',
} as const;
