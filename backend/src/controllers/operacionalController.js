import * as bloqueioService from '../services/bloqueioService.js';
import * as configuracaoService from '../services/configuracaoService.js';
import * as horarioService from '../services/horarioService.js';

export const publicConfig = async (_request, response) =>
  response.json({ data: await configuracaoService.publicConfig() });
export const adminConfig = async (_request, response) =>
  response.json({ data: await configuracaoService.adminConfig() });
export const updateConfig = async (request, response) =>
  response.json({ data: await configuracaoService.update(request.body) });
export const publicHours = async (_request, response) =>
  response.json({ data: await horarioService.publicHours() });
export const adminHours = async (_request, response) =>
  response.json({ data: await horarioService.adminHours() });
export const updateHours = async (request, response) =>
  response.json({ data: await horarioService.updateBusiness(request.body.dias) });
export const barberHours = async (request, response) =>
  response.json({ data: await horarioService.getBarberHours(request.params.id) });
export const updateBarberHours = async (request, response) =>
  response.json({
    data: await horarioService.updateBarberHours(request.params.id, request.body.dias),
  });
export const myHours = async (request, response) =>
  response.json({ data: await horarioService.myHours(request.auth.usuario.id) });
export const adminBlocks = async (request, response) =>
  response.json(await bloqueioService.listAdmin(request.query));
export const createAdminBlock = async (request, response) =>
  response
    .status(201)
    .json({ data: await bloqueioService.createAdmin(request.body, request.auth.usuario.id) });
export const removeAdminBlock = async (request, response) => {
  await bloqueioService.remove(request.params.id, request.auth.usuario.id, true);
  response.status(204).end();
};
export const myBlocks = async (request, response) =>
  response.json(await bloqueioService.listMine(request.auth.usuario.id, request.query));
export const createMyBlock = async (request, response) =>
  response
    .status(201)
    .json({ data: await bloqueioService.createMine(request.body, request.auth.usuario.id) });
export const removeMyBlock = async (request, response) => {
  await bloqueioService.remove(request.params.id, request.auth.usuario.id, false);
  response.status(204).end();
};
