import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { articlesController } from './articles.controller';

export const articlesRoutes = Router();

articlesRoutes.get('/articles', requireAuth, articlesController.list);
articlesRoutes.get('/articles/:id', requireAuth, articlesController.getById);
articlesRoutes.get('/articles/:id/versions', requireAuth, articlesController.listVersions);
articlesRoutes.get('/articles/:id/versions/:versionId', requireAuth, articlesController.getVersion);
articlesRoutes.post('/articles', requireAuth, requireRole('admin'), articlesController.create);
