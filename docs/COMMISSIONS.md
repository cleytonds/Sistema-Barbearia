# Comissões — Elite Barbearia 081

## 1. Objetivo

O módulo de comissões organiza a remuneração operacional dos profissionais com base em atendimentos elegíveis.

A estrutura foi adicionada em uma etapa posterior ao módulo de planos, com migration específica.

Este documento registra apenas conceitos confirmados e não fixa percentuais comerciais que pertencem à configuração real da operação.

## 2. Componentes

O backend possui módulos dedicados equivalentes a:

```text
domain/commissions/
repositories/comissaoRepository.js
services/comissaoService.js
controllers/adminComissaoController.js
routes/adminComissaoRoutes.js
validators/comissaoValidators.js
```

O frontend possui área administrativa específica para comissões.

## 3. Persistência

Migration:

```text
017_create_barber_commissions.sql
```

O domínio possui persistência relacionada a conceitos como:

```text
comissoes
configuracoes_comissao_barbeiros
```

A comissão mantém vínculo com atendimento/profissional para preservar rastreabilidade.

## 4. Fonte do cálculo

Comissão não deve nascer de um número livre enviado pelo frontend.

A base deve vir de fatos persistidos:

- agendamento;
- profissional;
- modalidade do atendimento;
- valores/snapshots aplicáveis;
- configuração de comissão;
- estado elegível do atendimento.

O backend é a autoridade.

## 5. Plano x avulso

A separação entre `PLANO` e `AVULSO` fornece base para regras distintas de comissão sem depender de interpretação manual posterior.

Nenhum percentual é documentado aqui porque deve ser lido da configuração real.

## 6. Agendamento como referência

```text
agendamento
    |
    +--> barbeiro
    +--> tipo de cobrança
    +--> preço/snapshot
    +--> status
    +--> comissão
```

Isso evita criar valores financeiros desconectados do atendimento que os originou.

## 7. Integridade histórica

Uma comissão já registrada não deve mudar apenas porque amanhã o preço do serviço, plano ou percentual configurado foi alterado.

O sistema deve preservar os dados históricos necessários para auditoria.

## 8. Estado do atendimento

Atendimento pendente não representa automaticamente serviço realizado. A elegibilidade de comissão é decidida pelo domínio a partir do estado do agendamento.

## 9. Área administrativa

As rotas administrativas de comissão são protegidas por autenticação e papel administrativo:

```text
auth()
+
requireAdmin()
```

A interface administrativa não substitui as validações do backend.

## 10. Área do barbeiro

O profissional não pode:

- alterar comissão de outro profissional;
- forçar percentual;
- definir valor base arbitrário;
- acessar dados financeiros administrativos fora do escopo permitido;
- contornar autorização enviando outro `barbeiroId`.

## 11. SQL e dinheiro

```text
dinheiro → DECIMAL
queries  → parametrizadas
campos dinâmicos → allowlist
```

O frontend não deve usar ponto flutuante como fonte de verdade financeira.

## 12. Concorrência e duplicidade

Se uma comissão nasce de um evento de atendimento, replays e concorrência não podem produzir efeitos financeiros duplicados. Associação com o agendamento e constraints do banco fazem parte da proteção.

## 13. Cancelamentos

Cancelamento não deve produzir comissão como se o atendimento tivesse sido realizado, salvo regra comercial explicitamente implementada e auditável.

## 14. Planos

O fato de um atendimento ser coberto por plano não permite que o frontend escolha a comissão. O módulo consome a classificação/snapshots decididos pelo backend.

## 15. Segurança

Nunca retornar na área de comissões:

- senha;
- hash de senha;
- JWT;
- token de recuperação;
- chave Brevo;
- credenciais de banco.

## 16. Testes

O projeto possui testes específicos para domínio/HTTP de comissões e integração.

Cenários relevantes:

- autorização administrativa;
- cálculo/consulta por dados persistidos;
- isolamento de profissionais;
- modalidade plano/avulso;
- estados do atendimento;
- integridade financeira;
- prevenção de duplicidade.

## 17. Relação com arquivamento do barbeiro

A migration seguinte adiciona arquivamento operacional:

```text
018_create_barber_appointment_archives.sql
```

Arquivar na interface não significa apagar agendamento, histórico, comissão ou uso de plano. O arquivo é um estado operacional de visualização do profissional.

## 18. Regra de ouro

Comissão é consequência de fatos persistidos do atendimento e de regras administrativas. Nunca é um valor confiado ao navegador.
