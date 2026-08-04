import { hashPassword } from '../auth/password.js';
import { pool } from '../config/database.js';
import * as barbeiroRepository from '../repositories/barbeiroRepository.js';
import * as servicoRepository from '../repositories/servicoRepository.js';
import { AppError } from '../utils/AppError.js';
import { normalizeEmail, normalizeName, normalizePhone } from '../utils/normalize.js';
import { paginationResult, parsePagination } from '../utils/pagination.js';

const allowedSorts = { id: 'b.id', nome: 'u.nome', criado_em: 'b.criado_em' };

function toPublicBarber(barber) {
  return {
    id: String(barber.id),
    nome: barber.nome,
    descricao: barber.descricao,
    foto_url: barber.foto_url,
    especialidades: barber.especialidades,
  };
}

/** Lista barbeiros com paginação e exposição adequada ao contexto público. */
export async function list(query, publicOnly) {
  const serviceId = publicOnly && query.servicoId ? Number(query.servicoId) : null;
  if (serviceId) {
    const service = await servicoRepository.findService(serviceId);
    if (!service?.ativo) {
      throw new AppError('ServiÃ§o nÃ£o encontrado.', 404, 'SERVICE_NOT_FOUND');
    }
  }
  const pagination = parsePagination(query, allowedSorts, 'nome');
  const result = await barbeiroRepository.listBarbers({
    publicOnly,
    search: query.search?.trim() ?? '',
    ativo: query.ativo,
    serviceId,
    pagination,
  });
  const rows = publicOnly ? result.rows.map(toPublicBarber) : result.rows;
  return paginationResult(rows, result.total, pagination);
}

/** Obtém um barbeiro e impede exposição pública de perfis desativados. */
export async function get(barbeiroId, publicOnly = false) {
  const barber = await barbeiroRepository.findBarber(barbeiroId);
  if (!barber || (publicOnly && (!barber.ativo || !barber.usuario_ativo))) {
    throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');
  }
  return publicOnly ? toPublicBarber(barber) : barber;
}

export async function services(barbeiroId, publicOnly = false) {
  await get(barbeiroId, publicOnly);
  return barbeiroRepository.getServices(barbeiroId, publicOnly);
}

export async function me(usuarioId) {
  const barber = await barbeiroRepository.findBarberByUser(usuarioId);
  if (!barber || !barber.ativo || !barber.usuario_ativo) {
    throw new AppError('Perfil profissional não encontrado.', 404, 'BARBER_NOT_FOUND');
  }
  return barber;
}

export async function updateMe(usuarioId, data) {
  const barber = await me(usuarioId);
  await pool.execute(
    'UPDATE barbeiros SET descricao = ?, especialidades = ?, foto_url = ? WHERE id = ?',
    [
      data.descricao?.trim() || null,
      data.especialidades?.trim() || null,
      data.foto_url || null,
      barber.id,
    ],
  );
  return me(usuarioId);
}

/**
 * Cria o usuário e o perfil profissional do barbeiro na mesma transação.
 * Uma falha na segunda inserção desfaz o usuário, evitando contas órfãs.
 */
export async function create(data) {
  const passwordHash = await hashPassword(data.senha);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [userResult] = await connection.execute(
      `
        INSERT INTO usuarios (nome, email, telefone, senha_hash, perfil, ativo)
        VALUES (?, ?, ?, ?, 'barbeiro', TRUE)
      `,
      [
        normalizeName(data.nome),
        normalizeEmail(data.email),
        normalizePhone(data.telefone),
        passwordHash,
      ],
    );
    const [barberResult] = await connection.execute(
      `
        INSERT INTO barbeiros (usuario_id, descricao, foto_url, especialidades)
        VALUES (?, ?, ?, ?)
      `,
      [
        userResult.insertId,
        data.descricao?.trim() || null,
        data.foto_url || null,
        data.especialidades?.trim() || null,
      ],
    );
    await connection.commit();
    return barbeiroRepository.findBarber(barberResult.insertId);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AppError('E-mail ou telefone já cadastrado.', 409, 'DUPLICATE_USER');
    }
    throw error;
  } finally {
    connection.release();
  }
}

/** Atualiza dados pessoais e profissionais de forma atômica. */
export async function update(barbeiroId, data) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const barber = await barbeiroRepository.findBarber(barbeiroId, connection);
    if (!barber) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');

    await connection.execute('UPDATE usuarios SET nome = ?, email = ?, telefone = ? WHERE id = ?', [
      normalizeName(data.nome),
      normalizeEmail(data.email),
      normalizePhone(data.telefone),
      barber.usuario_id,
    ]);
    await connection.execute(
      `
        UPDATE barbeiros
        SET descricao = ?, foto_url = ?, especialidades = ?
        WHERE id = ?
      `,
      [
        data.descricao?.trim() || null,
        data.foto_url || null,
        data.especialidades?.trim() || null,
        barbeiroId,
      ],
    );
    await connection.commit();
    return barbeiroRepository.findBarber(barbeiroId);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AppError('E-mail ou telefone já cadastrado.', 409, 'DUPLICATE_USER');
    }
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Aplica desativação lógica tanto à conta quanto ao perfil profissional.
 * Os registros permanecem no banco para preservar referências históricas.
 */
export async function setStatus(barbeiroId, ativo) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const barber = await barbeiroRepository.findBarber(barbeiroId, connection);
    if (!barber) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');
    await connection.execute('UPDATE usuarios SET ativo = ? WHERE id = ?', [
      ativo,
      barber.usuario_id,
    ]);
    await connection.execute('UPDATE barbeiros SET ativo = ? WHERE id = ?', [ativo, barbeiroId]);
    await connection.commit();
    return barbeiroRepository.findBarber(barbeiroId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Sincroniza a lista final de serviços executados por um barbeiro.
 *
 * O barbeiro é bloqueado e todos os serviços são validados antes da remoção dos
 * vínculos anteriores. Assim, qualquer falha preserva integralmente o estado anterior.
 */
export async function syncServices(barbeiroId, servicoIds) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('SELECT id FROM barbeiros WHERE id = ? FOR UPDATE', [barbeiroId]);
    const barber = await barbeiroRepository.findBarber(barbeiroId, connection);
    if (!barber || !barber.ativo || !barber.usuario_ativo) {
      throw new AppError('Barbeiro não encontrado ou inativo.', 404, 'BARBER_NOT_FOUND');
    }

    if (servicoIds.length) {
      const placeholders = servicoIds.map(() => '?').join(', ');
      const [servicesFound] = await connection.query(
        `SELECT id, ativo FROM servicos WHERE id IN (${placeholders})`,
        servicoIds,
      );
      if (servicesFound.length !== servicoIds.length) {
        throw new AppError('Serviço não encontrado.', 404, 'SERVICE_NOT_FOUND');
      }
      if (servicesFound.some((service) => !service.ativo)) {
        throw new AppError('Serviço inativo.', 422, 'BUSINESS_RULE_VIOLATION');
      }
    }

    await connection.execute('DELETE FROM barbeiro_servicos WHERE barbeiro_id = ?', [barbeiroId]);
    for (const servicoId of servicoIds) {
      await connection.execute(
        'INSERT INTO barbeiro_servicos (barbeiro_id, servico_id) VALUES (?, ?)',
        [barbeiroId, servicoId],
      );
    }
    await connection.commit();
    return barbeiroRepository.getServices(barbeiroId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
