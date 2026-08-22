export async function findOwnedForUpdate(id, barberId, connection) {
  const [[row]] = await connection.execute(
    `SELECT id, barbeiro_id, status
     FROM agendamentos
     WHERE id = ? AND barbeiro_id = ?
     LIMIT 1 FOR UPDATE`,
    [id, barberId],
  );
  return row ?? null;
}

export async function archive({ appointmentId, barberId, userId }, connection) {
  await connection.execute(
    `INSERT INTO agendamentos_arquivados_barbeiro
       (agendamento_id, barbeiro_id, arquivado_por)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE agendamento_id = VALUES(agendamento_id)`,
    [appointmentId, barberId, userId],
  );
}
