import { body, query } from 'express-validator';

import { MAX_PAGE_SIZE } from '../utils/pagination.js';

const photoUrl = body('foto_url')
  .optional({ nullable: true })
  .custom((value) => {
    try {
      const url = new URL(value);
      const localDevelopment =
        process.env.NODE_ENV !== 'production' &&
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname);
      if (url.protocol === 'https:' || localDevelopment) return true;
    } catch {
      // A mensagem de validação abaixo unifica URLs malformadas e protocolos proibidos.
    }
    throw new Error('URL inválida');
  });

const base = [
  body('nome').isString().trim().isLength({ min: 3, max: 150 }),
  body('email')
    .customSanitizer((value) => String(value).trim().toLowerCase())
    .isEmail()
    .isLength({ max: 254 }),
  body('telefone')
    .customSanitizer((value) => String(value).replace(/\D/g, ''))
    .isLength({ min: 10, max: 11 }),
  body('descricao').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('especialidades').optional({ nullable: true }).isString().isLength({ max: 500 }),
  photoUrl,
];
const allow = (allowed) =>
  body().custom((value) => {
    if (Object.keys(value).some((key) => !allowed.includes(key)))
      throw new Error('campos não permitidos');
    return true;
  });

export const createBarberValidator = [
  allow([
    'nome',
    'email',
    'telefone',
    'senha',
    'confirmacaoSenha',
    'descricao',
    'foto_url',
    'especialidades',
  ]),
  ...base,
  body('senha')
    .isLength({ min: 8, max: 72 })
    .matches(/[A-Za-zÀ-ÿ]/)
    .matches(/\d/),
  body('confirmacaoSenha').custom((value, { req }) => value === req.body.senha),
];
export const updateBarberValidator = [
  allow(['nome', 'email', 'telefone', 'descricao', 'foto_url', 'especialidades']),
  ...base,
];
export const updateOwnBarberValidator = [
  allow(['descricao', 'foto_url', 'especialidades']),
  body('descricao').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  body('especialidades').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  photoUrl,
];
export const adminBarberListValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  query('search').optional().isString().trim().isLength({ max: 150 }),
  query('ativo').optional().isIn(['true', 'false', 'all']),
  query('sort').optional().isIn(['id', 'nome', 'criado_em']),
  query('order').optional().isIn(['asc', 'desc']),
];
export const syncServicesValidator = [
  body('servicoIds')
    .isArray({ max: 100 })
    .custom((value) => new Set(value.map(String)).size === value.length),
  body('servicoIds.*').isInt({ min: 1 }),
];

export const publicBarberListValidator = [
  query('servicoId').optional().isInt({ min: 1 }).toInt(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  query('search').optional().isString().trim().isLength({ max: 150 }),
  query('sort').optional().isIn(['id', 'nome', 'criado_em']),
  query('order').optional().isIn(['asc', 'desc']),
];
