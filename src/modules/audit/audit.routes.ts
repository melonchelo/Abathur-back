import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { auditController } from './audit.controller';

export const auditRoutes = Router();

auditRoutes.get('/audit', requireAuth, requireRole('admin'), auditController.list);
