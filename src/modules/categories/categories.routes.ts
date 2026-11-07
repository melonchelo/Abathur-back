import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { categoriesController } from './categories.controller';

export const categoriesRoutes = Router();

categoriesRoutes.get('/categories', requireAuth, categoriesController.list);
categoriesRoutes.get('/categories/:id', requireAuth, categoriesController.getById);
categoriesRoutes.post('/categories', requireAuth, requireRole('admin'), categoriesController.create);
categoriesRoutes.patch('/categories/:id', requireAuth, requireRole('admin'), categoriesController.update);
