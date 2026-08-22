import { body, header, param, query } from 'express-validator';
import { IDEMPOTENCY_KEY_MAX_LENGTH, IDEMPOTENCY_KEY_MIN_LENGTH } from '../config/httpConfig.js';
import { SUBSCRIPTION_STATUS } from '../domain/plans/constants.js';
import { isValidTimeZone } from '../utils/dateTime.js';
import { MAX_PAGE_SIZE } from '../utils/pagination.js';
import { isMoney } from '../utils/decimal.js';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const positiveId = (field) =>
  param(field).custom((value) => {
    if (!/^[1-9]\d{0,19}$/.test(value) || BigInt(value) > 18446744073709551615n)
      throw new Error('identificador invÃ¡lido');
    return true;
  });
const strictBody = (allowed) =>
  body().custom((value) => {
    if (Object.keys(value).some((key) => !allowed.includes(key)))
      throw new Error('campos não permitidos');
    return true;
  });

export const planIdValidator = [positiveId('id')];

export const createPlanValidator = [
  strictBody([
    'nome',
    'descricao',
    'preco',
    'adesaoInicio',
    'adesaoFim',
    'utilizacaoInicio',
    'utilizacaoFim',
    'possuiLimiteSemanal',
    'limiteSemanal',
    'possuiLimiteTotal',
    'limiteTotal',
    'servicos',
    'barbeiros',
  ]),
  body('nome').isString().trim().isLength({ min: 2, max: 120 }),
  body('descricao').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('preco').custom(isMoney),
  body('adesaoInicio').matches(datePattern),
  body('adesaoFim').matches(datePattern),
  body('utilizacaoInicio').matches(datePattern),
  body('utilizacaoFim').matches(datePattern),
  body('possuiLimiteSemanal').isBoolean(),
  body('limiteSemanal').optional({ nullable: true }).isInt({ min: 1 }),
  body('possuiLimiteTotal').isBoolean(),
  body('limiteTotal').optional({ nullable: true }).isInt({ min: 1 }),
  body('servicos').isArray({ min: 1 }),
  body('servicos.*').custom((value) => /^[1-9]\d*$/.test(String(value))),
  body('barbeiros').isArray({ min: 1 }),
  body('barbeiros.*').custom((value) => /^[1-9]\d*$/.test(String(value))),
];

export const updatePlanValidator = [
  ...planIdValidator,
  strictBody([
    'nome',
    'descricao',
    'preco',
    'adesaoInicio',
    'adesaoFim',
    'utilizacaoInicio',
    'utilizacaoFim',
    'possuiLimiteSemanal',
    'limiteSemanal',
    'possuiLimiteTotal',
    'limiteTotal',
    'servicos',
    'barbeiros',
  ]),
  body('nome').isString().trim().isLength({ min: 2, max: 120 }),
  body('descricao').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('preco').custom(isMoney),
  body('adesaoInicio').matches(datePattern),
  body('adesaoFim').matches(datePattern),
  body('utilizacaoInicio').matches(datePattern),
  body('utilizacaoFim').matches(datePattern),
  body('possuiLimiteSemanal').isBoolean(),
  body('limiteSemanal').optional({ nullable: true }).isInt({ min: 1 }),
  body('possuiLimiteTotal').isBoolean(),
  body('limiteTotal').optional({ nullable: true }).isInt({ min: 1 }),
  body('servicos').isArray({ min: 1 }),
  body('servicos.*').isInt({ min: 1 }),
  body('barbeiros').isArray({ min: 1 }),
  body('barbeiros.*').isInt({ min: 1 }),
];

export const planStatusValidator = [
  ...planIdValidator,
  strictBody(['acao', 'motivo']),
  body('acao')
    .isIn([
      'ativar',
      'desativar',
      'abrir_adesoes',
      'fechar_adesoes',
      'permitir_uso',
      'suspender_uso',
    ])
    .toLowerCase(),
  body('motivo').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
];

export const planActiveValidator = [
  ...planIdValidator,
  strictBody(['ativo']),
  body('ativo').isBoolean({ strict: true }),
];

export const planEnrollmentValidator = [
  ...planIdValidator,
  strictBody(['abertas']),
  body('abertas').isBoolean({ strict: true }),
];

export const planUsageValidator = [
  ...planIdValidator,
  strictBody(['permitido', 'motivo']),
  body('permitido').isBoolean({ strict: true }),
  body('motivo')
    .if(body('permitido').equals('false'))
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 }),
];

export const publicPlanListValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  query('search').optional().isString().trim().isLength({ max: 120 }),
  query('date').optional().matches(datePattern),
  query('sort').optional().isIn(['id', 'nome', 'preco', 'criado_em']),
  query('order').optional().isIn(['asc', 'desc']),
];

export const adminPlanListValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  query('search').optional().isString().trim().isLength({ max: 120 }),
  query('ativo').optional().isIn(['true', 'false', 'all']),
  query('adesoesAbertas').optional().isIn(['true', 'false', 'all']),
  query('usoStatus').optional().isIn(['permitido', 'suspenso']),
  query('date').optional().matches(datePattern),
  query('sort').optional().isIn(['id', 'nome', 'preco', 'criado_em']),
  query('order').optional().isIn(['asc', 'desc']),
];

export const signPlanValidator = [
  ...planIdValidator,
  header('Idempotency-Key')
    .isString()
    .isLength({ min: IDEMPOTENCY_KEY_MIN_LENGTH, max: IDEMPOTENCY_KEY_MAX_LENGTH })
    .matches(/^[\x21-\x7e]+$/),
  strictBody(['inicioEm', 'fimEm', 'fusoHorario']),
];

export const cancelOwnSubscriptionValidator = [
  strictBody(['motivo']),
  body('motivo').isString().trim().isLength({ min: 1, max: 500 }),
];

export const myUsagesValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
];

export const adminSubscriptionCreateValidator = [
  strictBody(['clienteId', 'planoId', 'inicioEm', 'fimEm', 'fusoHorario']),
  body('clienteId').isInt({ min: 1 }),
  body('planoId').isInt({ min: 1 }),
  body('inicioEm').matches(datePattern),
  body('fimEm').matches(datePattern),
  body('fusoHorario').optional({ nullable: true }).custom(isValidTimeZone),
];

export const adminSubscriptionListValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  query('plano').optional().isInt({ min: 1 }),
  query('cliente').optional().isInt({ min: 1 }),
  query('status').optional().isIn(Object.values(SUBSCRIPTION_STATUS)),
  query('sort').optional().isIn(['id', 'status', 'criado_em', 'inicio_em', 'fim_em']),
  query('order').optional().isIn(['asc', 'desc']),
];

export const adminSubscriptionStatusValidator = [
  positiveId('id'),
  strictBody(['motivo']),
  body('motivo').isString().trim().isLength({ min: 1, max: 500 }),
];

export const paymentConfirmationValidator = [
  positiveId('id'),
  strictBody(['referencia', 'valor', 'observacao', 'forma']),
  body('referencia').matches(/^\d{4}-\d{2}-01$/),
  body('valor').custom(isMoney),
  body('observacao').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('forma').equals('presencial'),
];
