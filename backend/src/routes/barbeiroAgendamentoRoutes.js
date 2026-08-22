import { Router } from 'express';
import * as controller from '../controllers/barbeiroAgendamentoController.js';
import { auth } from '../middlewares/auth.js';
import { requireBarbeiro } from '../middlewares/authorize.js';
import { appointmentReadLimiter, appointmentStatusLimiter } from '../middlewares/rateLimiters.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { appointmentIdValidator } from '../validators/agendamentoValidators.js';
import {
  barberListValidator,
  statusValidator,
} from '../validators/barbeiroAgendamentoValidators.js';

export const barbeiroAgendamentoRoutes = Router();
barbeiroAgendamentoRoutes.use(auth(), requireBarbeiro());
barbeiroAgendamentoRoutes.get(
  '/',
  appointmentReadLimiter,
  barberListValidator,
  validate,
  asyncHandler(controller.list),
);
barbeiroAgendamentoRoutes.get(
  '/:id',
  appointmentReadLimiter,
  appointmentIdValidator,
  validate,
  asyncHandler(controller.detail),
);
barbeiroAgendamentoRoutes.put(
  '/:id/status',
  appointmentStatusLimiter,
  statusValidator,
  validate,
  asyncHandler(controller.updateStatus),
);
barbeiroAgendamentoRoutes.put(
  '/:id/arquivar',
  appointmentStatusLimiter,
  appointmentIdValidator,
  validate,
  asyncHandler(controller.archive),
);
