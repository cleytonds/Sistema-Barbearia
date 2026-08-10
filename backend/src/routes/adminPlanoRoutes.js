import { Router } from 'express';

import { auth } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import * as controller from '../controllers/adminPlanoController.js';
import {
  adminPlanListValidator,
  adminSubscriptionCreateValidator,
  adminSubscriptionListValidator,
  adminSubscriptionStatusValidator,
  createPlanValidator,
  paymentConfirmationValidator,
  planActiveValidator,
  planEnrollmentValidator,
  planIdValidator,
  planUsageValidator,
  updatePlanValidator,
} from '../validators/planoValidators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminPlanoRoutes = Router();
adminPlanoRoutes.use(auth(), requireAdmin());

adminPlanoRoutes.get(
  '/planos',
  adminPlanListValidator,
  validate,
  asyncHandler(controller.listPlanos),
);
adminPlanoRoutes.post(
  '/planos',
  createPlanValidator,
  validate,
  asyncHandler(controller.createPlano),
);
adminPlanoRoutes.get('/planos/:id', planIdValidator, validate, asyncHandler(controller.getPlano));
adminPlanoRoutes.put(
  '/planos/:id',
  updatePlanValidator,
  validate,
  asyncHandler(controller.updatePlano),
);
adminPlanoRoutes.patch(
  '/planos/:id/status',
  planActiveValidator,
  validate,
  asyncHandler((req, res) =>
    controller.updatePlanStatus(
      Object.assign(req, { body: { acao: req.body.ativo ? 'ativar' : 'desativar' } }),
      res,
    ),
  ),
);
adminPlanoRoutes.patch(
  '/planos/:id/adesoes',
  planEnrollmentValidator,
  validate,
  asyncHandler((req, res) =>
    controller.updatePlanStatus(
      Object.assign(req, { body: { acao: req.body.abertas ? 'abrir_adesoes' : 'fechar_adesoes' } }),
      res,
    ),
  ),
);
adminPlanoRoutes.patch(
  '/planos/:id/uso',
  planUsageValidator,
  validate,
  asyncHandler((req, res) =>
    controller.updatePlanStatus(
      Object.assign(req, {
        body: {
          acao: req.body.permitido ? 'permitir_uso' : 'suspender_uso',
          motivo: req.body.motivo,
        },
      }),
      res,
    ),
  ),
);
adminPlanoRoutes.get(
  '/planos/:id/assinantes',
  planIdValidator,
  validate,
  asyncHandler(controller.listSubscribers),
);

adminPlanoRoutes.get(
  '/assinaturas-planos',
  adminSubscriptionListValidator,
  validate,
  asyncHandler(controller.listSubscriptions),
);
adminPlanoRoutes.get(
  '/assinaturas-planos/:id',
  planIdValidator,
  validate,
  asyncHandler(controller.getSubscription),
);
adminPlanoRoutes.post(
  '/assinaturas-planos',
  adminSubscriptionCreateValidator,
  validate,
  asyncHandler(controller.createSubscription),
);
adminPlanoRoutes.put(
  '/assinaturas-planos/:id/confirmar-pagamento',
  paymentConfirmationValidator,
  validate,
  asyncHandler(controller.confirmPayment),
);
for (const action of ['suspender', 'reativar', 'cancelar']) {
  adminPlanoRoutes.put(
    `/assinaturas-planos/:id/${action}`,
    adminSubscriptionStatusValidator,
    validate,
    asyncHandler((req, res) =>
      controller.updateSubscriptionStatus(
        Object.assign(req, { params: { ...req.params, action } }),
        res,
      ),
    ),
  );
}
adminPlanoRoutes.get(
  '/assinaturas-planos/:id/usos',
  planIdValidator,
  validate,
  asyncHandler(controller.listSubscriptionUsages),
);
adminPlanoRoutes.get(
  '/assinaturas-planos/:id/historico',
  planIdValidator,
  validate,
  asyncHandler(controller.listSubscriptionHistory),
);
