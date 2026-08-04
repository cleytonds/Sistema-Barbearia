import { pool } from '../config/database.js';

export async function create(event, connection) {
  const [result] = await connection.execute(
    `INSERT INTO historico_agendamentos (
       agendamento_id, tipo_evento, status_anterior, status_novo,
       alterado_por, observacao, dados_anteriores, dados_novos
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.appointmentId,
      event.type,
      event.previousStatus ?? null,
      event.nextStatus ?? null,
      event.changedBy,
      event.note ?? null,
      event.previousData == null ? null : JSON.stringify(event.previousData),
      event.newData == null ? null : JSON.stringify(event.newData),
    ],
  );
  return result.insertId;
}

export async function listByAppointment(appointmentId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT id, tipo_evento, status_anterior, status_novo, alterado_por,
            observacao, dados_anteriores, dados_novos, criado_em
     FROM historico_agendamentos WHERE agendamento_id=? ORDER BY criado_em, id`,
    [appointmentId],
  );
  return rows;
}
