import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { commentsController } from './comments.controller';

export const commentsRoutes = Router();

commentsRoutes.get('/proposals/:id/comments', requireAuth, commentsController.list);
commentsRoutes.post('/proposals/:id/comments', requireAuth, requireRole('cliente', 'moderador'), commentsController.create);
