import { Router } from 'express';

import { auth } from '../middlewares/auth.js';
import { requireCliente } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import * as planoController from '../controllers/planoController.js';
import {
  planIdValidator,
  publicPlanListValidator,
  signPlanValidator,
} from '../validators/planoValidators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const planoRoutes = Router();

planoRoutes.get('/', publicPlanListValidator, validate, asyncHandler(planoController.listPublic));
planoRoutes.get('/:id', planIdValidator, validate, asyncHandler(planoController.getPublic));
planoRoutes.post(
  '/:id/assinar',
  auth(),
  requireCliente(),
  signPlanValidator,
  validate,
  asyncHandler(planoController.sign),
);
