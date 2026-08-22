import { Router } from 'express';
import * as controller from '../controllers/adminComissaoController.js';
import { auth } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  barberCommissionValidator,
  commissionIdValidator,
  commissionListValidator,
  planServiceCommissionValidator,
} from '../validators/comissaoValidators.js';

export const adminComissaoRoutes = Router();
adminComissaoRoutes.use(auth(), requireAdmin());

adminComissaoRoutes.put(
  '/barbeiros/:barbeiroId/comissao',
  barberCommissionValidator,
  validate,
  asyncHandler(controller.configureBarber),
);
adminComissaoRoutes.put(
  '/planos/:planoId/servicos/:servicoId/comissao',
  planServiceCommissionValidator,
  validate,
  asyncHandler(controller.configurePlanService),
);
adminComissaoRoutes.get(
  '/comissoes',
  commissionListValidator,
  validate,
  asyncHandler(controller.list),
);
adminComissaoRoutes.put(
  '/comissoes/:id/pagar',
  commissionIdValidator,
  validate,
  asyncHandler(controller.markPaid),
);
