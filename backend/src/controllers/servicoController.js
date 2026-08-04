import * as servicoService from '../services/servicoService.js';

export const listPublic = async (request, response) =>
  response.json(await servicoService.list(request.query, true));
export const getPublic = async (request, response) =>
  response.json({ data: await servicoService.get(request.params.id, true) });
export const listAdmin = async (request, response) =>
  response.json(await servicoService.list(request.query, false));
export const getAdmin = async (request, response) =>
  response.json({ data: await servicoService.get(request.params.id) });
export const create = async (request, response) =>
  response.status(201).json({ data: await servicoService.create(request.body) });
export const update = async (request, response) =>
  response.json({ data: await servicoService.update(request.params.id, request.body) });
export const status = async (request, response) =>
  response.json({ data: await servicoService.setStatus(request.params.id, request.body.ativo) });
