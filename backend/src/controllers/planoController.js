import * as assinaturaService from '../services/assinaturaPlanoService.js';
import * as planoService from '../services/planoService.js';
import { IDEMPOTENCY_KEY_HEADER } from '../config/httpConfig.js';
import { serializeAssinatura, stringifyIds } from './assinaturaSerializer.js';

function serializePublicPlan(plan) {
  return stringifyIds({
    id: plan.id,
    nome: plan.nome,
    descricao: plan.descricao,
    preco: plan.preco,
    adesaoInicio: plan.adesaoInicio ?? plan.adesao_inicio,
    adesaoFim: plan.adesaoFim ?? plan.adesao_fim,
    utilizacaoInicio: plan.utilizacaoInicio ?? plan.utilizacao_inicio,
    utilizacaoFim: plan.utilizacaoFim ?? plan.utilizacao_fim,
    possuiLimiteSemanal: plan.possuiLimiteSemanal ?? plan.possui_limite_semanal,
    limiteSemanal: plan.limiteSemanal ?? plan.limite_semanal,
    possuiLimiteTotal: plan.possuiLimiteTotal ?? plan.possui_limite_total,
    limiteTotal: plan.limiteTotal ?? plan.limite_total,
    ...(plan.servicos && { servicos: plan.servicos }),
    ...(plan.barbeiros && { barbeiros: plan.barbeiros }),
  });
}

export const listPublic = async (request, response) => {
  const result = await planoService.listarPlanosPublicos({ query: request.query });
  response.json({ ...result, data: result.data.map(serializePublicPlan) });
};

export const getPublic = async (request, response) =>
  response.json({
    data: serializePublicPlan(await planoService.obterPlanoPublico({ id: request.params.id })),
  });

export const sign = async (request, response) => {
  const result = await assinaturaService.solicitarAdesao({
    data: { planoId: request.params.id, clientId: request.auth.usuario.id },
    actorId: request.auth.usuario.id,
    idempotencyKey: request.get(IDEMPOTENCY_KEY_HEADER),
    requestId: request.requestId,
  });
  response.status(result.replay ? 200 : 201).json({
    replay: result.replay,
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
    data: stringifyIds(
      await assinaturaService.listarMeusUsos({
        clientId: request.auth.usuario.id,
        assinaturaId: meuPlano.id,
      }),
    ),
  });
};

export const cancelMyPlan = async (request, response) => {
  const id = await assinaturaService.cancelarMinhaAssinatura({
    clientId: request.auth.usuario.id,
    motivo: request.body.motivo,
    requestId: request.requestId,
  });
  response.json({
    data: serializeAssinatura(await assinaturaService.obterAssinaturaAdmin({ id })),
  });
};
