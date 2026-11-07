import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { proposalsController } from './proposals.controller';

export const proposalsRoutes = Router();

proposalsRoutes.get('/proposals', requireAuth, proposalsController.list);
proposalsRoutes.get('/proposals/:id', requireAuth, proposalsController.getById);
proposalsRoutes.post('/proposals', requireAuth, requireRole('cliente', 'moderador'), proposalsController.create);
proposalsRoutes.post('/proposals/:id/voting', requireAuth, requireRole('moderador', 'admin'), proposalsController.openVoting);
proposalsRoutes.post('/proposals/:id/close', requireAuth, requireRole('moderador', 'admin'), proposalsController.closeVoting);
proposalsRoutes.post('/proposals/:id/decision', requireAuth, requireRole('admin'), proposalsController.decide);
