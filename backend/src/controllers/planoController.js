import * as assinaturaService from '../services/assinaturaPlanoService.js';
import * as planoService from '../services/planoService.js';
import { IDEMPOTENCY_KEY_HEADER } from '../config/httpConfig.js';
import { serializeAssinatura } from './assinaturaSerializer.js';

export const listPublic = async (request, response) =>
  response.json(await planoService.listarPlanosPublicos({ query: request.query }));

export const getPublic = async (request, response) =>
  response.json({ data: await planoService.obterPlanoPublico({ id: request.params.id }) });

export const sign = async (request, response) => {
  const result = await assinaturaService.solicitarAdesao({
    data: { ...request.body, planoId: request.params.id, clientId: request.auth.usuario.id },
    actorId: request.auth.usuario.id,
    idempotencyKey: request.get(IDEMPOTENCY_KEY_HEADER),
    requestId: request.requestId,
  });
  response.status(result.replay ? 200 : 201).json({
    data: serializeAssinatura(
      await assinaturaService.obterAssinaturaAdmin({ id: result.assinaturaId }),
    ),
  });
};

export const myPlan = async (request, response) =>
  response.json({
    data: serializeAssinatura(
      await assinaturaService.obterMeuPlano({ clientId: request.auth.usuario.id }),
    ),
  });

export const myUsages = async (request, response) => {
  const meuPlano = await assinaturaService.obterMeuPlano({
    clientId: request.auth.usuario.id,
  });
  response.json({
    data: await assinaturaService.listarMeusUsos({
      clientId: request.auth.usuario.id,
      assinaturaId: meuPlano.id,
    }),
  });
};

export const cancelOwn = async (request, response) => {
  const meuPlano = await assinaturaService.obterMeuPlano({
    clientId: request.auth.usuario.id,
  });
  await assinaturaService.cancelarAssinatura({
    id: meuPlano.id,
    motivo: request.body.motivo,
    actorId: request.auth.usuario.id,
    requestId: request.requestId,
  });
  response.json({
    data: serializeAssinatura(await assinaturaService.obterAssinaturaAdmin({ id: meuPlano.id })),
  });
};
