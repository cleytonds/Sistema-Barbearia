import { Router } from 'express';

import { auth } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';

import * as barbeiroController from '../controllers/barbeiroController.js';
import * as operacionalController from '../controllers/operacionalController.js';
import * as servicoController from '../controllers/servicoController.js';

import {
  createBarberValidator,
  syncServicesValidator,
  updateBarberValidator,
} from '../validators/barbeiroValidators.js';
import {
  blockValidator,
  configValidator,
  weekValidator,
} from '../validators/operacionalValidators.js';
import { idValidator, serviceValidator, statusValidator } from '../validators/servicoValidators.js';

import { asyncHandler } from '../utils/asyncHandler.js';

export const adminRoutes = Router();

// Toda a área administrativa exige sessão válida e perfil de administrador.
adminRoutes.use(auth(), requireAdmin());

// Serviços
adminRoutes.get('/servicos', asyncHandler(servicoController.listAdmin));
adminRoutes.post('/servicos', serviceValidator, validate, asyncHandler(servicoController.create));
adminRoutes.get('/servicos/:id', idValidator, validate, asyncHandler(servicoController.getAdmin));
adminRoutes.put(
  '/servicos/:id',
  idValidator,
  serviceValidator,
  validate,
  asyncHandler(servicoController.update),
);
adminRoutes.patch(
  '/servicos/:id/status',
  idValidator,
  statusValidator,
  validate,
  asyncHandler(servicoController.status),
);

// Barbeiros
adminRoutes.get('/barbeiros', asyncHandler(barbeiroController.listAdmin));
adminRoutes.post(
  '/barbeiros',
  createBarberValidator,
  validate,
  asyncHandler(barbeiroController.create),
);
adminRoutes.get('/barbeiros/:id', idValidator, validate, asyncHandler(barbeiroController.getAdmin));
adminRoutes.put(
  '/barbeiros/:id',
  idValidator,
  updateBarberValidator,
  validate,
  asyncHandler(barbeiroController.update),
);
adminRoutes.patch(
  '/barbeiros/:id/status',
  idValidator,
  statusValidator,
  validate,
  asyncHandler(barbeiroController.status),
);

// Serviços executados pelo barbeiro
adminRoutes.get(
  '/barbeiros/:id/servicos',
  idValidator,
  validate,
  asyncHandler(barbeiroController.getServices),
);
adminRoutes.put(
  '/barbeiros/:id/servicos',
  idValidator,
  syncServicesValidator,
  validate,
  asyncHandler(barbeiroController.syncServices),
);

// Jornada individual
adminRoutes.get(
  '/barbeiros/:id/horarios',
  idValidator,
  validate,
  asyncHandler(operacionalController.barberHours),
);
adminRoutes.put(
  '/barbeiros/:id/horarios',
  idValidator,
  weekValidator,
  validate,
  asyncHandler(operacionalController.updateBarberHours),
);

// Configuração operacional e funcionamento global
adminRoutes.get('/configuracoes', asyncHandler(operacionalController.adminConfig));
adminRoutes.put(
  '/configuracoes',
  configValidator,
  validate,
  asyncHandler(operacionalController.updateConfig),
);
adminRoutes.get('/horarios-funcionamento', asyncHandler(operacionalController.adminHours));
adminRoutes.put(
  '/horarios-funcionamento',
  weekValidator,
  validate,
  asyncHandler(operacionalController.updateHours),
);

// Bloqueios de agenda
adminRoutes.get('/bloqueios', asyncHandler(operacionalController.adminBlocks));
adminRoutes.post(
  '/bloqueios',
  blockValidator,
  validate,
  asyncHandler(operacionalController.createAdminBlock),
);
adminRoutes.delete(
  '/bloqueios/:id',
  idValidator,
  validate,
  asyncHandler(operacionalController.removeAdminBlock),
);
