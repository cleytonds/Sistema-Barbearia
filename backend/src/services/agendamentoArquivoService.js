import { pool } from '../config/database.js';
import { TERMINAL_STATUSES } from '../domain/appointments/constants.js';
import * as appointmentRepository from '../repositories/agendamentoRepository.js';
import * as archiveRepository from '../repositories/agendamentoArquivoRepository.js';
import { AppError } from '../utils/AppError.js';

export async function archiveMine({ id, userId }) {
  const barber = await appointmentRepository.findBarberByUser(userId);
  if (!barber?.ativo) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const appointment = await archiveRepository.findOwnedForUpdate(id, barber.id, connection);
    if (!appointment) {
      throw new AppError('Agendamento não encontrado.', 404, 'APPOINTMENT_NOT_FOUND');
    }
    if (!TERMINAL_STATUSES.includes(appointment.status)) {
      throw new AppError(
        'Somente agendamentos encerrados podem ser arquivados.',
        422,
        'APPOINTMENT_NOT_ARCHIVABLE',
      );
    }
    await archiveRepository.archive(
      { appointmentId: appointment.id, barberId: barber.id, userId },
      connection,
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
