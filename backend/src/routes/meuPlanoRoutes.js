import { Router } from 'express';

import { auth } from '../middlewares/auth.js';
import { requireCliente } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import * as planoController from '../controllers/planoController.js';
import { myUsagesValidator } from '../validators/planoValidators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const meuPlanoRoutes = Router();

meuPlanoRoutes.use(auth(), requireCliente());

meuPlanoRoutes.get('/', asyncHandler(planoController.myPlan));
meuPlanoRoutes.get('/usos', myUsagesValidator, validate, asyncHandler(planoController.myUsages));
