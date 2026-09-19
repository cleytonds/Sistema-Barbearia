import { body, query } from 'express-validator';
import { APPOINTMENT_STATUS } from '../domain/appointments/constants.js';
import { CLIENT_NOTES_MAX_LENGTH } from '../config/httpConfig.js';
import { appointmentIdValidator, appointmentListValidator } from './agendamentoValidators.js';

export const barberListValidator = [
  ...appointmentListValidator,
  query('arquivados').optional().isBoolean().toBoolean(),
];
export const createBarberAppointmentValidator = [
  body().custom((value) => {
    if (
      Object.keys(value).some(
        (key) => !['clienteId', 'servicoId', 'data', 'horaInicio', 'observacao'].includes(key),
      )
    )
      throw new Error('campos não permitidos');
    return true;
  }),
  body('clienteId').isInt({ min: 1 }).toInt(),
  body('servicoId').isInt({ min: 1 }).toInt(),
  body('data').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('horaInicio').matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  body('observacao')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: CLIENT_NOTES_MAX_LENGTH }),
];
export const createGuestBarberAppointmentValidator = [
  body().custom((value) => {
    if (
      Object.keys(value).some(
        (key) =>
          ![
            'clienteNome',
            'clienteTelefone',
            'servicoId',
            'data',
            'horaInicio',
            'observacao',
          ].includes(key),
      )
    )
      throw new Error('campos nÃ£o permitidos');
    return true;
  }),
  body('clienteNome').isString().trim().isLength({ min: 1, max: 150 }),
  body('clienteTelefone').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('servicoId').isInt({ min: 1 }).toInt(),
  body('data').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('horaInicio').matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  body('observacao')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: CLIENT_NOTES_MAX_LENGTH }),
];
export const statusValidator = [
  ...appointmentIdValidator,
  body().custom((value) => {
    if (Object.keys(value).some((key) => !['status', 'justificativa'].includes(key)))
      throw new Error('campos não permitidos');
    return true;
  }),
  body('status').isIn([
    APPOINTMENT_STATUS.CONFIRMED,
    APPOINTMENT_STATUS.IN_SERVICE,
    APPOINTMENT_STATUS.COMPLETED,
    APPOINTMENT_STATUS.ABSENT,
  ]),
  body('justificativa')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ min: 3, max: 500 }),
];
