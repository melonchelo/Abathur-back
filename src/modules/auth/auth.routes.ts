import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from './auth.middleware';

export const authRoutes = Router();

authRoutes.post('/auth/login', authController.login);
authRoutes.get('/me', requireAuth, authController.me);
