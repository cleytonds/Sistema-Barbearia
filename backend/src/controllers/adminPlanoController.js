import * as assinaturaService from '../services/assinaturaPlanoService.js';
import * as planoService from '../services/planoService.js';
import { serializeAssinatura } from './assinaturaSerializer.js';

export const listPlanos = async (request, response) =>
  response.json(await planoService.listarPlanosAdmin({ query: request.query }));

export const createPlano = async (request, response) => {
  const planId = await planoService.criarPlano({
    data: request.body,
    actorId: request.auth.usuario.id,
    requestId: request.requestId,
  });
  response.status(201).json({ data: await planoService.obterPlanoAdmin({ id: planId }) });
};

export const updatePlano = async (request, response) => {
  await planoService.editarPlano({
    id: request.params.id,
    data: request.body,
    actorId: request.auth.usuario.id,
    requestId: request.requestId,
  });
  response.json({ data: await planoService.obterPlanoAdmin({ id: request.params.id }) });
};

const statusActions = {
  ativar: (service, params) =>
    service.ativarPlano({ id: params.id, actorId: params.actorId, requestId: params.requestId }),
  desativar: (service, params) =>
    service.desativarPlano({ id: params.id, actorId: params.actorId, requestId: params.requestId }),
  abrir_adesoes: (service, params) =>
    service.abrirAdesoes({ id: params.id, actorId: params.actorId, requestId: params.requestId }),
  fechar_adesoes: (service, params) =>
    service.fecharAdesoes({ id: params.id, actorId: params.actorId, requestId: params.requestId }),
  permitir_uso: (service, params) =>
    service.permitirUso({ id: params.id, actorId: params.actorId, requestId: params.requestId }),
  suspender_uso: (service, params) =>
    service.suspenderUso({
      id: params.id,
      actorId: params.actorId,
      motivo: params.motivo,
      requestId: params.requestId,
    }),
};

export const updatePlanStatus = async (request, response) => {
  const action = statusActions[request.body.acao];
  await action(planoService, {
    id: request.params.id,
    actorId: request.auth.usuario.id,
    motivo: request.body.motivo,
    requestId: request.requestId,
  });
  response.json({ data: await planoService.obterPlanoAdmin({ id: request.params.id }) });
};

export const createSubscription = async (request, response) => {
  const assinaturaId = await assinaturaService.criarAssinaturaAdministrativa({
    data: {
      clientId: request.body.clienteId,
      planoId: request.body.planoId,
      inicioEm: request.body.inicioEm,
      fimEm: request.body.fimEm,
      fusoHorario: request.body.fusoHorario,
    },
    actorId: request.auth.usuario.id,
    requestId: request.requestId,
  });
  response.status(201).json({
    data: serializeAssinatura(await assinaturaService.obterAssinaturaAdmin({ id: assinaturaId })),
  });
};

export const listSubscriptions = async (request, response) => {
  const result = await assinaturaService.listarAssinaturasAdmin({ query: request.query });
  response.json({ ...result, data: result.data.map(serializeAssinatura) });
};

const subscriptionActions = {
  suspender: (service, params) =>
    service.suspenderAssinatura({
      id: params.id,
      motivo: params.motivo,
      actorId: params.actorId,
      requestId: params.requestId,
    }),
  reativar: (service, params) =>
    service.reativarAssinatura({
      id: params.id,
      motivo: params.motivo,
      actorId: params.actorId,
      requestId: params.requestId,
    }),
  cancelar: (service, params) =>
    service.cancelarAssinatura({
      id: params.id,
      motivo: params.motivo,
      actorId: params.actorId,
      requestId: params.requestId,
    }),
};

export const updateSubscriptionStatus = async (request, response) => {
  const action = subscriptionActions[request.body.acao];
  await action(assinaturaService, {
    id: request.params.id,
    motivo: request.body.motivo,
    actorId: request.auth.usuario.id,
    requestId: request.requestId,
  });
  response.json({
    data: serializeAssinatura(
      await assinaturaService.obterAssinaturaAdmin({ id: request.params.id }),
    ),
  });
};
