import assert from 'node:assert/strict';
import test from 'node:test';

import { diagnosticarConfiguracaoComissaoPreDeploy } from '../src/services/comissaoService.js';

function repository({ barbeiros, servicosPlanos }) {
  return {
    listarBarbeirosAtivosParaDiagnostico: async () => barbeiros,
    listarServicosDePlanosParaDiagnostico: async () => servicosPlanos,
  };
}

const barbeiroCompleto = {
  barbeiro_id: 1,
  barbeiro_nome: 'Barbeiro de teste',
  configuracao_ativa: true,
  percentual_avulso: '50.00',
  percentual_plano: '40.00',
};

const servicoPlanoCompleto = {
  plano_id: 1,
  plano_nome: 'Plano de teste',
  servico_id: 1,
  servico_nome: 'Serviço de teste',
  valor_base_comissao: '30.00',
};

test('pré-deploy de comissão: configuração completa passa', async () => {
  const report = await diagnosticarConfiguracaoComissaoPreDeploy({
    repository: repository({
      barbeiros: [barbeiroCompleto],
      servicosPlanos: [servicoPlanoCompleto],
    }),
  });

  assert.deepEqual(report, {
    ok: true,
    barbeirosSemPercentualAvulso: [],
    servicosPlanosSemValorBase: [],
    configuracoesInvalidas: [],
  });
});

test('pré-deploy de comissão: barbeiro sem percentual avulso é detectado', async () => {
  const report = await diagnosticarConfiguracaoComissaoPreDeploy({
    repository: repository({
      barbeiros: [{ ...barbeiroCompleto, configuracao_ativa: false, percentual_avulso: null }],
      servicosPlanos: [servicoPlanoCompleto],
    }),
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.barbeirosSemPercentualAvulso, [{ id: '1', nome: 'Barbeiro de teste' }]);
});

test('pré-deploy de comissão: serviço de plano sem valor-base é detectado', async () => {
  const report = await diagnosticarConfiguracaoComissaoPreDeploy({
    repository: repository({
      barbeiros: [barbeiroCompleto],
      servicosPlanos: [{ ...servicoPlanoCompleto, valor_base_comissao: null }],
    }),
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.servicosPlanosSemValorBase, [
    {
      plano: { id: '1', nome: 'Plano de teste' },
      servico: { id: '1', nome: 'Serviço de teste' },
    },
  ]);
});

test('pré-deploy de comissão: configuração inválida é detectada', async () => {
  const report = await diagnosticarConfiguracaoComissaoPreDeploy({
    repository: repository({
      barbeiros: [{ ...barbeiroCompleto, percentual_avulso: '-1.00', percentual_plano: '101.00' }],
      servicosPlanos: [{ ...servicoPlanoCompleto, valor_base_comissao: '0.00' }],
    }),
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.configuracoesInvalidas, [
    { id: '1', nome: 'Barbeiro de teste', campo: 'percentualAvulso' },
    { id: '1', nome: 'Barbeiro de teste', campo: 'percentualPlano' },
    {
      plano: { id: '1', nome: 'Plano de teste' },
      servico: { id: '1', nome: 'Serviço de teste' },
      campo: 'valorBaseComissao',
    },
  ]);
});
