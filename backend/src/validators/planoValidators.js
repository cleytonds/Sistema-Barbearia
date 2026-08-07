import { body, header, param, query } from 'express-validator';
import { IDEMPOTENCY_KEY_MAX_LENGTH, IDEMPOTENCY_KEY_MIN_LENGTH } from '../config/httpConfig.js';
import { SUBSCRIPTION_STATUS } from '../domain/plans/constants.js';
import { isValidTimeZone } from '../utils/dateTime.js';
import { MAX_PAGE_SIZE } from '../utils/pagination.js';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const positiveId = (field) => param(field).isInt({ min: 1 }).toInt();
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
  body('preco').isString().notEmpty(),
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
  body('preco').isString().notEmpty(),
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
  body('inicioEm').matches(datePattern),
  body('fimEm').matches(datePattern),
  body('fusoHorario').optional({ nullable: true }).custom(isValidTimeZone),
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
  param('id').isInt({ min: 1 }).toInt(),
  strictBody(['acao', 'motivo']),
  body('acao').isIn(['suspender', 'reativar', 'cancelar']).toLowerCase(),
  body('motivo').isString().trim().isLength({ min: 1, max: 500 }),
];
