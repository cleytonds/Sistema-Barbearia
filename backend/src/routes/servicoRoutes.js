import { Router } from 'express';

import { validate } from '../middlewares/validate.js';
import * as servicoController from '../controllers/servicoController.js';
import { idValidator } from '../validators/servicoValidators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const servicoRoutes = Router();

servicoRoutes.get('/', asyncHandler(servicoController.listPublic));
servicoRoutes.get('/:id', idValidator, validate, asyncHandler(servicoController.getPublic));
