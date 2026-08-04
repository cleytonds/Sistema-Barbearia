import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { servicoRoutes } from './servicoRoutes.js';
import { barbeiroRoutes } from './barbeiroRoutes.js';
import { configuracaoRoutes } from './configuracaoRoutes.js';
import { adminRoutes } from './adminRoutes.js';
import { barbeiroAreaRoutes } from './barbeiroAreaRoutes.js';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'barbearia-api', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/servicos', servicoRoutes);
router.use('/barbeiros', barbeiroRoutes);
router.use('/configuracoes', configuracaoRoutes);
router.use('/admin', adminRoutes);
router.use('/barbeiro', barbeiroAreaRoutes);
