import * as comissaoService from '../services/comissaoService.js';

export const configureBarber = async (request, response) => {
  const data = await comissaoService.configurarComissao({
    barbeiroId: request.params.barbeiroId,
    percentualAvulso: request.body.percentualAvulso,
    percentualPlano: request.body.percentualPlano,
    ativo: request.body.ativo,
  });
  response.json({
    data: {
      barbeiroId: String(data.barbeiro_id),
      percentualAvulso: data.percentual_avulso,
      percentualPlano: data.percentual_plano,
      ativo: Boolean(data.ativo),
    },
  });
};

export const configurePlanService = async (request, response) =>
  response.json({
    data: await comissaoService.configurarValorBasePlano({
      planoId: request.params.planoId,
      servicoId: request.params.servicoId,
      valorBase: request.body.valorBase,
    }),
  });

export const list = async (request, response) =>
  response.json(await comissaoService.listarComissoes({ query: request.query }));

export const markPaid = async (request, response) =>
  response.json({
    data: await comissaoService.marcarComissaoComoPaga({
      id: request.params.id,
      actorId: request.auth.usuario.id,
    }),
  });
