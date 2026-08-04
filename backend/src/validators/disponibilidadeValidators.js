import { query } from 'express-validator';

const allowedQueryFields = ['barbeiroId', 'servicoId', 'data'];

export const disponibilidadeValidator = [
  query().custom((value) => {
    if (Object.keys(value).some((field) => !allowedQueryFields.includes(field))) {
      throw new Error('parâmetros não permitidos');
    }
    return true;
  }),
  query('barbeiroId').isInt({ min: 1 }),
  query('servicoId').isInt({ min: 1 }),
  query('data').matches(/^\d{4}-\d{2}-\d{2}$/),
];
