import { body, param } from 'express-validator';

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
