import { body, param, query } from 'express-validator';
import { isValidTimeZone } from '../utils/dateTime.js';
import { APPOINTMENT_STATUS } from '../domain/appointments/constants.js';
import { MAX_PAGE_SIZE } from '../utils/pagination.js';
const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const weekValidator = [
  body('dias')
    .isArray({ min: 7, max: 7 })
    .custom(
      (d) =>
        new Set(d.map((x) => x.diaSemana)).size === 7 &&
        d.every((x) => x.diaSemana >= 0 && x.diaSemana <= 6),
    ),
  body('dias.*.horaInicio').matches(time),
  body('dias.*.horaFim')
    .matches(time)
    .custom((v, { req, pathValues }) => v > req.body.dias[pathValues[0]].horaInicio),
  body('dias.*.intervaloInicio').optional({ nullable: true }).matches(time),
  body('dias.*.intervaloFim').optional({ nullable: true }).matches(time),
  body('dias.*').custom(
    (d) =>
      (d.intervaloInicio == null) === (d.intervaloFim == null) &&
      (!d.intervaloInicio ||
        (d.intervaloInicio >= d.horaInicio &&
          d.intervaloFim <= d.horaFim &&
          d.intervaloFim > d.intervaloInicio)),
  ),
  body('dias.*.ativo').isBoolean(),
];
export const configValidator = [
  body().custom((v) => {
    if (
      Object.keys(v).some(
        (k) =>
          ![
            'nome_barbearia',
            'telefone',
            'endereco',
            'fuso_horario',
            'tempo_minimo_cancelamento_horas',
            'antecedencia_maxima_dias',
            'intervalo_entre_atendimentos_minutos',
          ].includes(k),
      )
    )
      throw new Error('campos não permitidos');
    return true;
  }),
  body('nome_barbearia').isString().isLength({ min: 2, max: 150 }),
  body('telefone').optional({ nullable: true }).isString().isLength({ max: 20 }),
  body('endereco').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('fuso_horario').custom(isValidTimeZone),
  body('tempo_minimo_cancelamento_horas').isInt({ min: 0, max: 720 }),
  body('antecedencia_maxima_dias').isInt({ min: 1, max: 365 }),
  body('intervalo_entre_atendimentos_minutos').isInt({ min: 0, max: 240 }),
];
const fields = [
  body('inicioLocal').isString(),
  body('fimLocal').isString(),
  body('motivo').isString().trim().isLength({ min: 3, max: 500 }),
];
export const blockValidator = [
  body('barbeiroId').optional({ nullable: true }).isInt({ min: 1 }),
  ...fields,
  body('justificativaPassado')
    .optional({ nullable: true })
    .isString()
    .isLength({ min: 3, max: 500 }),
];
export const myBlockValidator = [
  body('barbeiroId')
    .optional({ nullable: true })
    .custom((value) => value == null),
  body('justificativaPassado').not().exists(),
  ...fields,
];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const dashboardValidator = [query('data').matches(datePattern)];
export const blockListValidator = [
  query('dataInicial').optional().matches(datePattern),
  query('dataFinal').optional().matches(datePattern),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  query('order').optional().isIn(['asc', 'desc']),
];
export const clientListValidator = [
  query('search').isString().trim().isLength({ min: 2, max: 150 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
];
export const clientHistoryValidator = [
  param('id').isInt({ min: 1 }),
  query('status').optional().isIn(Object.values(APPOINTMENT_STATUS)),
  query('dataInicial').optional().matches(datePattern),
  query('dataFinal').optional().matches(datePattern),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  query('sort').optional().isIn(['inicio', 'criadoEm', 'status']),
  query('order').optional().isIn(['asc', 'desc']),
];
