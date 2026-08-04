import { Router } from 'express';
import * as controller from '../controllers/agendamentoController.js';
import { auth } from '../middlewares/auth.js';
import { requireCliente } from '../middlewares/authorize.js';
import {
  appointmentCreationLimiter,
  appointmentMutationLimiter,
  appointmentReadLimiter,
} from '../middlewares/rateLimiters.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  appointmentIdValidator,
  appointmentListValidator,
  cancelAppointmentValidator,
  createAppointmentValidator,
  rescheduleAppointmentValidator,
} from '../validators/agendamentoValidators.js';

export const agendamentoRoutes = Router();
agendamentoRoutes.use(auth(), requireCliente());
agendamentoRoutes.post(
  '/',
  appointmentCreationLimiter,
  createAppointmentValidator,
  validate,
  asyncHandler(controller.create),
);
agendamentoRoutes.get(
  '/meus',
  appointmentReadLimiter,
  appointmentListValidator,
  validate,
  asyncHandler(controller.listMine),
);
agendamentoRoutes.get(
  '/:id',
  appointmentReadLimiter,
  appointmentIdValidator,
  validate,
  asyncHandler(controller.detail),
);
agendamentoRoutes.put(
  '/:id/cancelar',
  appointmentMutationLimiter,
  cancelAppointmentValidator,
  validate,
  asyncHandler(controller.cancel),
);
agendamentoRoutes.put(
  '/:id/reagendar',
  appointmentMutationLimiter,
  rescheduleAppointmentValidator,
  validate,
  asyncHandler(controller.reschedule),
);
