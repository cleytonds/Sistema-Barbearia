import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { servicoRoutes } from './servicoRoutes.js';
import { barbeiroRoutes } from './barbeiroRoutes.js';
import { configuracaoRoutes } from './configuracaoRoutes.js';
import { adminRoutes } from './adminRoutes.js';
import { barbeiroAreaRoutes } from './barbeiroAreaRoutes.js';
import { disponibilidadeRoutes } from './disponibilidadeRoutes.js';
import { agendamentoRoutes } from './agendamentoRoutes.js';
import { adminAgendamentoRoutes } from './adminAgendamentoRoutes.js';
import { barbeiroAgendamentoRoutes } from './barbeiroAgendamentoRoutes.js';
import { planoRoutes } from './planoRoutes.js';
import { meuPlanoRoutes } from './meuPlanoRoutes.js';
import { adminPlanoRoutes } from './adminPlanoRoutes.js';
import { adminComissaoRoutes } from './adminComissaoRoutes.js';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'barbearia-api', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/servicos', servicoRoutes);
router.use('/barbeiros', barbeiroRoutes);
router.use('/configuracoes', configuracaoRoutes);
router.use('/admin', adminRoutes);
router.use('/admin', adminPlanoRoutes);
router.use('/admin', adminComissaoRoutes);
router.use('/barbeiro', barbeiroAreaRoutes);
router.use('/disponibilidade', disponibilidadeRoutes);
router.use('/agendamentos', agendamentoRoutes);
router.use('/admin/agendamentos', adminAgendamentoRoutes);
router.use('/barbeiro/agendamentos', barbeiroAgendamentoRoutes);
router.use('/planos', planoRoutes);
router.use('/meu-plano', meuPlanoRoutes);
