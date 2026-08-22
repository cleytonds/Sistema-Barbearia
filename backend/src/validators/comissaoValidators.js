import { body, param, query } from 'express-validator';
import { MAX_PAGE_SIZE } from '../utils/pagination.js';
import { isMoney } from '../utils/decimal.js';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const positiveId = (field) =>
  param(field).custom((value) => {
    if (!/^[1-9]\d{0,19}$/.test(value) || BigInt(value) > 18446744073709551615n)
      throw new Error('identificador inválido');
    return true;
  });
const strictBody = (allowed) =>
  body().custom((value) => {
    if (Object.keys(value ?? {}).some((key) => !allowed.includes(key)))
      throw new Error('campos não permitidos');
    return true;
  });
const percentage = (field) =>
  body(field)
    .isString()
    .matches(/^\d+(?:\.\d{1,2})?$/)
    .custom((value) => Number(value) <= 100);

export const barberCommissionValidator = [
  positiveId('barbeiroId'),
  strictBody(['percentualAvulso', 'percentualPlano', 'ativo']),
  percentage('percentualAvulso'),
  percentage('percentualPlano'),
  body('ativo').optional().isBoolean({ strict: true }),
];

export const planServiceCommissionValidator = [
  positiveId('planoId'),
  positiveId('servicoId'),
  strictBody(['valorBase']),
  body('valorBase')
    .custom(isMoney)
    .custom((value) => Number(value) > 0),
];

export const commissionListValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  query('barbeiroId')
    .optional()
    .matches(/^[1-9]\d{0,19}$/),
  query('inicio').optional().matches(datePattern),
  query('fim').optional().matches(datePattern),
  query('tipo').optional().isIn(['avulso', 'plano']),
  query('status').optional().isIn(['pendente', 'paga']),
  query('sort').optional().isIn(['id', 'criadoEm', 'valorComissao']),
  query('order').optional().isIn(['asc', 'desc']),
  query().custom((value) => !value.inicio || !value.fim || value.fim >= value.inicio),
];

export const commissionIdValidator = [positiveId('id'), strictBody([])];
