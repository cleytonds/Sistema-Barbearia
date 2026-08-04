import { pool } from '../../config/database.js';

const lockName = 'barbearia_initial_seed';

// Dados demonstrativos provisórios: revisar antes do uso real.
const hours = [
  { day: 0, start: '09:00:00', end: '18:00:00', breakStart: '12:00:00', breakEnd: '13:00:00', active: false },
  ...[1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    start: '09:00:00',
    end: '18:00:00',
    breakStart: '12:00:00',
    breakEnd: '13:00:00',
    active: true
  }))
];

const services = [
  ['Corte masculino', 'Corte masculino tradicional ou moderno.', '40.00', 40],
  ['Barba', 'Modelagem e acabamento de barba.', '30.00', 30],
  ['Corte e barba', 'Serviço combinado de corte masculino e barba.', '65.00', 70],
  ['Acabamento', 'Acabamento e contornos do corte.', '20.00', 20],
  ['Sobrancelha', 'Design e acabamento de sobrancelha.', '15.00', 15]
];

async function main() {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (lock.acquired !== 1) throw new Error('Não foi possível obter o lock exclusivo do seed.');
    locked = true;
    await connection.beginTransaction();

    await connection.execute(`
      INSERT INTO configuracoes (
        id, nome_barbearia, fuso_horario, tempo_minimo_cancelamento_horas,
        antecedencia_maxima_dias, intervalo_entre_atendimentos_minutos
      ) VALUES (1, ?, ?, 2, 30, 0)
      ON DUPLICATE KEY UPDATE id = VALUES(id)
    `, ['Elite Barbearia 081', 'America/Recife']);

    for (const item of hours) {
      await connection.execute(`
        INSERT INTO horarios_funcionamento (
          dia_semana, hora_inicio, hora_fim, intervalo_inicio, intervalo_fim, ativo
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE dia_semana = VALUES(dia_semana)
      `, [item.day, item.start, item.end, item.breakStart, item.breakEnd, item.active]);
    }

    for (const [name, description, price, duration] of services) {
      const [[existing]] = await connection.execute(
        'SELECT id FROM servicos WHERE nome = ? LIMIT 1 FOR UPDATE',
        [name]
      );
      if (!existing) {
        await connection.execute(
          'INSERT INTO servicos (nome, descricao, preco, duracao_minutos) VALUES (?, ?, ?, ?)',
          [name, description, price, duration]
        );
      }
    }

    await connection.commit();
    console.log('[seed] configuração, horários e serviços verificados com sucesso.');
    console.log('[seed] preços, durações e horários são provisórios e devem ser revisados antes da produção.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (locked) await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
    connection.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`[seed] falha: ${error.message}`);
  process.exitCode = 1;
});

