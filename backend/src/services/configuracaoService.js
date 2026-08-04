import { pool } from '../config/database.js';
import * as operacionalRepository from '../repositories/operacionalRepository.js';

/** Retorna somente os campos operacionais que podem ser expostos sem autenticação. */
export async function publicConfig() {
  const configuration = await operacionalRepository.config();
  return {
    nome_barbearia: configuration.nome_barbearia,
    telefone: configuration.telefone,
    endereco: configuration.endereco,
    fuso_horario: configuration.fuso_horario,
  };
}

export const adminConfig = () => operacionalRepository.config();

/** Atualiza exclusivamente o registro singleton de configuração, cujo id é sempre 1. */
export async function update(data) {
  await pool.execute(
    `
      UPDATE configuracoes
      SET nome_barbearia = ?, telefone = ?, endereco = ?, fuso_horario = ?,
          tempo_minimo_cancelamento_horas = ?, antecedencia_maxima_dias = ?,
          intervalo_entre_atendimentos_minutos = ?
      WHERE id = 1
    `,
    [
      data.nome_barbearia,
      data.telefone || null,
      data.endereco || null,
      data.fuso_horario,
      data.tempo_minimo_cancelamento_horas,
      data.antecedencia_maxima_dias,
      data.intervalo_entre_atendimentos_minutos,
    ],
  );
  return operacionalRepository.config();
}
