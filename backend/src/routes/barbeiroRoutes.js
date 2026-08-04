import { Router } from 'express';

import { validate } from '../middlewares/validate.js';
import * as barbeiroController from '../controllers/barbeiroController.js';
import { idValidator } from '../validators/servicoValidators.js';
import { publicBarberListValidator } from '../validators/barbeiroValidators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const barbeiroRoutes = Router();

barbeiroRoutes.get(
  '/',
  publicBarberListValidator,
  validate,
  asyncHandler(barbeiroController.listPublic),
);
barbeiroRoutes.get('/:id', idValidator, validate, asyncHandler(barbeiroController.getPublic));
barbeiroRoutes.get(
  '/:id/servicos',
  idValidator,
  validate,
  asyncHandler(barbeiroController.publicServices),
);
