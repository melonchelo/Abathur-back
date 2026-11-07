import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { reputationController } from './reputation.controller';

export const reputationRoutes = Router();

reputationRoutes.get('/users/:id/reputation', requireAuth, reputationController.getByUser);
