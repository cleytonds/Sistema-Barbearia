import { Router } from 'express';

import * as disponibilidadeController from '../controllers/disponibilidadeController.js';
import { availabilityLimiter } from '../middlewares/rateLimiters.js';
import { validate } from '../middlewares/validate.js';
import { disponibilidadeValidator } from '../validators/disponibilidadeValidators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const disponibilidadeRoutes = Router();

disponibilidadeRoutes.get(
  '/',
  availabilityLimiter,
  disponibilidadeValidator,
  validate,
  asyncHandler(disponibilidadeController.list),
);
