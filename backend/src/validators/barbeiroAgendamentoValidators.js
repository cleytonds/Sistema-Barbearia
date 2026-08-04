import { body } from 'express-validator';
import { APPOINTMENT_STATUS } from '../domain/appointments/constants.js';
import { appointmentIdValidator, appointmentListValidator } from './agendamentoValidators.js';

export const barberListValidator = appointmentListValidator;
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
