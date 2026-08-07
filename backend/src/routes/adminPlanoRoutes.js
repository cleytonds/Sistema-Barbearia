import { Router } from 'express';

import { auth } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import * as adminPlanoController from '../controllers/adminPlanoController.js';
import {
  adminPlanListValidator,
  adminSubscriptionCreateValidator,
  adminSubscriptionListValidator,
  adminSubscriptionStatusValidator,
  createPlanValidator,
  planStatusValidator,
  updatePlanValidator,
} from '../validators/planoValidators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminPlanoRoutes = Router();

adminPlanoRoutes.use(auth(), requireAdmin());

adminPlanoRoutes.get(
  '/planos',
  adminPlanListValidator,
  validate,
  asyncHandler(adminPlanoController.listPlanos),
);
adminPlanoRoutes.post(
  '/planos',
  createPlanValidator,
  validate,
  asyncHandler(adminPlanoController.createPlano),
);
adminPlanoRoutes.put(
  '/planos/:id',
  updatePlanValidator,
  validate,
  asyncHandler(adminPlanoController.updatePlano),
);
adminPlanoRoutes.patch(
  '/planos/:id/status',
  planStatusValidator,
  validate,
  asyncHandler(adminPlanoController.updatePlanStatus),
);
adminPlanoRoutes.post(
  '/assinaturas',
  adminSubscriptionCreateValidator,
  validate,
  asyncHandler(adminPlanoController.createSubscription),
);
adminPlanoRoutes.get(
  '/assinaturas',
  adminSubscriptionListValidator,
  validate,
  asyncHandler(adminPlanoController.listSubscriptions),
);
adminPlanoRoutes.patch(
  '/assinaturas/:id/status',
  adminSubscriptionStatusValidator,
  validate,
  asyncHandler(adminPlanoController.updateSubscriptionStatus),
);
