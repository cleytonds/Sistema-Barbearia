import { body, query } from 'express-validator';
import { CANCELLATION_REASON_MAX_LENGTH, CLIENT_NOTES_MAX_LENGTH } from '../config/httpConfig.js';
import { APPOINTMENT_ORIGIN, APPOINTMENT_STATUS } from '../domain/appointments/constants.js';
import { appointmentIdValidator } from './agendamentoValidators.js';
import { MAX_PAGE_SIZE } from '../utils/pagination.js';

const strict = (allowed) =>
  body().custom((value) => {
    if (Object.keys(value).some((key) => !allowed.includes(key)))
      throw new Error('campos não permitidos');
    return true;
  });
export const createAdminAppointmentValidator = [
  strict(['clienteId', 'barbeiroId', 'servicoId', 'data', 'horaInicio', 'observacoesInternas']),
  body('clienteId').isInt({ min: 1 }).toInt(),
  body('barbeiroId').isInt({ min: 1 }).toInt(),
  body('servicoId').isInt({ min: 1 }).toInt(),
  body('data').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('horaInicio').matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  body('observacoesInternas')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: CLIENT_NOTES_MAX_LENGTH }),
];
export const adminCancelValidator = [
  ...appointmentIdValidator,
  strict(['motivo', 'responsabilidade']),
  body('motivo').isString().trim().isLength({ min: 3, max: CANCELLATION_REASON_MAX_LENGTH }),
  body('responsabilidade').isIn(['cliente', 'barbearia']),
];
export const adminRescheduleValidator = [
  ...appointmentIdValidator,
  strict(['data', 'horaInicio', 'justificativa']),
  body('data').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('horaInicio').matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  body('justificativa')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ min: 3, max: CANCELLATION_REASON_MAX_LENGTH }),
];
export const adminListValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  query('barbeiroId').optional().isInt({ min: 1 }),
  query('clienteId').optional().isInt({ min: 1 }),
  query('servicoId').optional().isInt({ min: 1 }),
  query('status').optional().isIn(Object.values(APPOINTMENT_STATUS)),
  query('origem').optional().isIn(Object.values(APPOINTMENT_ORIGIN)),
  query('dataInicial')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/),
  query('dataFinal')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/),
  query('sort').optional().isIn(['inicio', 'criadoEm', 'status']),
  query('order').optional().isIn(['asc', 'desc']),
];
