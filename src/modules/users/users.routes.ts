import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { usersController } from './users.controller';

export const usersRoutes = Router();

usersRoutes.get('/users', requireAuth, usersController.list);
usersRoutes.get('/users/:id', requireAuth, usersController.getById);
usersRoutes.post('/users', requireAuth, requireRole('admin'), usersController.create);
usersRoutes.patch('/users/:id', requireAuth, requireRole('admin'), usersController.update);
usersRoutes.post('/users/:id/sanctions', requireAuth, requireRole('admin'), usersController.sanction);
