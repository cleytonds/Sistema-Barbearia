import * as barbeiroService from '../services/barbeiroService.js';

export const listPublic = async (request, response) =>
  response.json(await barbeiroService.list(request.query, true));

export const getPublic = async (request, response) =>
  response.json({ data: await barbeiroService.get(request.params.id, true) });

export const publicServices = async (request, response) =>
  response.json({ data: await barbeiroService.services(request.params.id, true) });

export const listAdmin = async (request, response) =>
  response.json(await barbeiroService.list(request.query, false));

export const getAdmin = async (request, response) =>
  response.json({ data: await barbeiroService.get(request.params.id) });

export const create = async (request, response) =>
  response.status(201).json({ data: await barbeiroService.create(request.body) });

export const update = async (request, response) =>
  response.json({ data: await barbeiroService.update(request.params.id, request.body) });

export const status = async (request, response) =>
  response.json({
    data: await barbeiroService.setStatus(request.params.id, request.body.ativo),
  });

export const getServices = async (request, response) =>
  response.json({ data: await barbeiroService.services(request.params.id) });

export const syncServices = async (request, response) =>
  response.json({
    data: await barbeiroService.syncServices(
      request.params.id,
      request.body.servicoIds.map(Number),
    ),
  });

export const me = async (request, response) =>
  response.json({ data: await barbeiroService.me(request.auth.usuario.id) });

export const updateMe = async (request, response) =>
  response.json({ data: await barbeiroService.updateMe(request.auth.usuario.id, request.body) });

export const myServices = async (request, response) => {
  const barber = await barbeiroService.me(request.auth.usuario.id);
  response.json({ data: await barbeiroService.services(barber.id) });
};
