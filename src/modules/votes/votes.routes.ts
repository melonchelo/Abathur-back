import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { votesController } from './votes.controller';

export const votesRoutes = Router();

votesRoutes.get('/proposals/:id/votes', requireAuth, votesController.list);
votesRoutes.post('/proposals/:id/votes', requireAuth, requireRole('moderador'), votesController.cast);
