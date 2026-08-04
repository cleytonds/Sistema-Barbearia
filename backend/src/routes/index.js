import { Router } from 'express';
import { authRoutes } from './authRoutes.js';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'barbearia-api', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
