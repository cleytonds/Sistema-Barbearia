import { Router } from 'express';
import * as controller from '../controllers/adminAgendamentoController.js';
import { auth } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/authorize.js';
import {
  appointmentCreationLimiter,
  appointmentMutationLimiter,
  appointmentReadLimiter,
  appointmentStatusLimiter,
} from '../middlewares/rateLimiters.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { appointmentIdValidator } from '../validators/agendamentoValidators.js';
import {
  adminCancelValidator,
  adminListValidator,
  adminRescheduleValidator,
  createAdminAppointmentValidator,
} from '../validators/adminAgendamentoValidators.js';
import { statusValidator } from '../validators/barbeiroAgendamentoValidators.js';

export const adminAgendamentoRoutes = Router();
adminAgendamentoRoutes.use(auth(), requireAdmin());
adminAgendamentoRoutes.get(
  '/',
  appointmentReadLimiter,
  adminListValidator,
  validate,
  asyncHandler(controller.list),
);
adminAgendamentoRoutes.get(
  '/:id',
  appointmentReadLimiter,
  appointmentIdValidator,
  validate,
  asyncHandler(controller.detail),
);
adminAgendamentoRoutes.post(
  '/',
  appointmentCreationLimiter,
  createAdminAppointmentValidator,
  validate,
  asyncHandler(controller.create),
);
adminAgendamentoRoutes.put(
  '/:id/status',
  appointmentStatusLimiter,
  statusValidator,
  validate,
  asyncHandler(controller.updateStatus),
);
adminAgendamentoRoutes.put(
  '/:id/cancelar',
  appointmentMutationLimiter,
  adminCancelValidator,
  validate,
  asyncHandler(controller.cancel),
);
adminAgendamentoRoutes.put(
  '/:id/reagendar',
  appointmentMutationLimiter,
  adminRescheduleValidator,
  validate,
  asyncHandler(controller.reschedule),
);
