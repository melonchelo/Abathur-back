import cors from 'cors';
import express, { Router, type Express } from 'express';
import { config } from './config';
import { articlesRoutes } from './modules/articles/articles.routes';
import { auditRoutes } from './modules/audit/audit.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { categoriesRoutes } from './modules/categories/categories.routes';
import { commentsRoutes } from './modules/comments/comments.routes';
import { proposalsRoutes } from './modules/proposals/proposals.routes';
import { reputationRoutes } from './modules/reputation/reputation.routes';
import { usersRoutes } from './modules/users/users.routes';
import { votesRoutes } from './modules/votes/votes.routes';
import { errorHandler, notFoundHandler } from './shared/error-handler';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  const api = Router();
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  api.use(authRoutes);
  api.use(usersRoutes);
  api.use(reputationRoutes);
  api.use(categoriesRoutes);
  api.use(articlesRoutes);
  api.use(proposalsRoutes);
  api.use(commentsRoutes);
  api.use(votesRoutes);
  api.use(auditRoutes);

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
