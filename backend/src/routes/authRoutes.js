import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import { auth } from '../middlewares/auth.js';
import {
  authenticatedLimiter,
  loginLimiter,
  passwordLimiter,
  recoveryLimiter,
  registerLimiter,
  resetLimiter,
} from '../middlewares/rateLimiters.js';
import { validate } from '../middlewares/validate.js';
import {
  changePasswordValidator,
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resetPasswordValidator,
} from '../validators/authValidators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authRoutes = Router();

authRoutes.post(
  '/cadastro',
  registerLimiter,
  registerValidator,
  validate,
  asyncHandler(controller.register),
);
authRoutes.post('/login', loginLimiter, loginValidator, validate, asyncHandler(controller.login));
authRoutes.post(
  '/esqueci-senha',
  recoveryLimiter,
  forgotPasswordValidator,
  validate,
  asyncHandler(controller.forgotPassword),
);
authRoutes.post(
  '/redefinir-senha',
  resetLimiter,
  resetPasswordValidator,
  validate,
  asyncHandler(controller.resetPassword),
);
authRoutes.use(auth(), authenticatedLimiter);
authRoutes.get('/me', asyncHandler(controller.me));
authRoutes.post('/logout', asyncHandler(controller.logout));
authRoutes.put(
  '/alterar-senha',
  passwordLimiter,
  changePasswordValidator,
  validate,
  asyncHandler(controller.changePassword),
);
