import { Router } from 'express';

import * as operacionalController from '../controllers/operacionalController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const configuracaoRoutes = Router();

// Estas respostas possuem projeções próprias e não expõem campos administrativos.
configuracaoRoutes.get('/publicas', asyncHandler(operacionalController.publicConfig));
configuracaoRoutes.get('/horarios', asyncHandler(operacionalController.publicHours));
