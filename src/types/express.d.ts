import type { User } from '../modules/users/users.model';

declare module 'express-serve-static-core' {
  interface Request {
    /** Usuario autenticado, leído de la base en cada pedido por `requireAuth`. */
    user?: User;
  }
}
