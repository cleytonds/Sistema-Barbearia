import { body, param, query } from 'express-validator';
import { CANCELLATION_REASON_MAX_LENGTH, CLIENT_NOTES_MAX_LENGTH } from '../config/httpConfig.js';
import { APPOINTMENT_STATUS } from '../domain/appointments/constants.js';
import { MAX_PAGE_SIZE } from '../utils/pagination.js';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const positiveId = (field) => body(field).isInt({ min: 1 }).toInt();
const strictBody = (allowed) =>
  body().custom((value) => {
    if (Object.keys(value).some((key) => !allowed.includes(key)))
      throw new Error('campos não permitidos');
    return true;
  });

export const appointmentIdValidator = [param('id').isInt({ min: 1 })];
export const createAppointmentValidator = [
  strictBody(['barbeiroId', 'servicoId', 'data', 'horaInicio', 'observacoes']),
  positiveId('barbeiroId'),
  positiveId('servicoId'),
  body('data').matches(datePattern),
  body('horaInicio').matches(timePattern),
  body('observacoes')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: CLIENT_NOTES_MAX_LENGTH }),
];
export const cancelAppointmentValidator = [
  ...appointmentIdValidator,
  strictBody(['motivo']),
  body('motivo')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: CANCELLATION_REASON_MAX_LENGTH }),
];
export const rescheduleAppointmentValidator = [
  ...appointmentIdValidator,
  strictBody(['data', 'horaInicio']),
  body('data').matches(datePattern),
  body('horaInicio').matches(timePattern),
];
export const appointmentListValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  query('status').optional().isIn(Object.values(APPOINTMENT_STATUS)),
  query('sort').optional().isIn(['inicio', 'criadoEm', 'status']),
  query('order').optional().isIn(['asc', 'desc']),
  query('periodo').optional().isIn(['inicio', 'historico', 'todos']),
  query('data').optional().matches(datePattern),
];
