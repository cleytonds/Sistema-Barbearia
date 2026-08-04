import { Router } from 'express';

import { auth } from '../middlewares/auth.js';
import { requireBarbeiro } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';

import * as barbeiroController from '../controllers/barbeiroController.js';
import * as operacionalController from '../controllers/operacionalController.js';

import { myBlockValidator } from '../validators/operacionalValidators.js';
import { idValidator } from '../validators/servicoValidators.js';

import { asyncHandler } from '../utils/asyncHandler.js';

export const barbeiroAreaRoutes = Router();

barbeiroAreaRoutes.use(auth(), requireBarbeiro());

// Perfil profissional
barbeiroAreaRoutes.get('/me', asyncHandler(barbeiroController.me));

// Serviços executados
barbeiroAreaRoutes.get('/me/servicos', asyncHandler(barbeiroController.myServices));

// Jornada de trabalho
barbeiroAreaRoutes.get('/me/horarios', asyncHandler(operacionalController.myHours));

// Bloqueios da própria agenda
barbeiroAreaRoutes.get('/me/bloqueios', asyncHandler(operacionalController.myBlocks));
barbeiroAreaRoutes.post(
  '/me/bloqueios',
  myBlockValidator,
  validate,
  asyncHandler(operacionalController.createMyBlock),
);
barbeiroAreaRoutes.delete(
  '/me/bloqueios/:id',
  idValidator,
  validate,
  asyncHandler(operacionalController.removeMyBlock),
);
