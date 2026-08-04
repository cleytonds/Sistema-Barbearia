import { body, param, query } from 'express-validator';
import { MAX_PAGE_SIZE } from '../utils/pagination.js';

import { isMoney } from '../utils/decimal.js';

const editableFields = ['nome', 'descricao', 'preco', 'duracao_minutos'];

export const idValidator = [param('id').isInt({ min: 1 })];

export const serviceValidator = [
  // A allowlist impede mass assignment do status ou de campos internos.
  body().custom((payload) => {
    if (Object.keys(payload).some((field) => !editableFields.includes(field))) {
      throw new Error('campos não permitidos');
    }
    return true;
  }),

  body('nome').isString().trim().isLength({ min: 2, max: 120 }),
  body('descricao').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('preco').custom(isMoney),
  body('duracao_minutos').isInt({ min: 1, max: 1_440 }),
];

export const statusValidator = [
  body().custom((payload) => Object.keys(payload).every((field) => field === 'ativo')),
  body('ativo').isBoolean(),
];
export const adminServiceListValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  query('search').optional().isString().trim().isLength({ max: 120 }),
  query('ativo').optional().isIn(['true', 'false', 'all']),
  query('sort').optional().isIn(['id', 'nome', 'preco', 'duracao_minutos', 'criado_em']),
  query('order').optional().isIn(['asc', 'desc']),
];
