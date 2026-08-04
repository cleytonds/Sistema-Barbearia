import * as servicoRepository from '../repositories/servicoRepository.js';
import { AppError } from '../utils/AppError.js';
import { normalizeName } from '../utils/normalize.js';
import { paginationResult, parsePagination } from '../utils/pagination.js';

const allowedSorts = {
  id: 'id',
  nome: 'nome',
  preco: 'preco',
  duracao_minutos: 'duracao_minutos',
  criado_em: 'criado_em',
};

function normalizeService(data) {
  return {
    // O nome é normalizado antes de alcançar o índice único da migration 013.
    nome: normalizeName(data.nome),
    descricao: data.descricao?.trim() || null,
    preco: data.preco,
    duracao_minutos: data.duracao_minutos,
  };
}

function throwDuplicateService(error) {
  if (error.code === 'ER_DUP_ENTRY') {
    throw new AppError('Já existe um serviço com esse nome.', 409, 'DUPLICATE_SERVICE');
  }
  throw error;
}

export async function list(query, publicOnly) {
  const pagination = parsePagination(query, allowedSorts, 'nome');
  const result = await servicoRepository.listServices({
    publicOnly,
    search: query.search?.trim() ?? '',
    ativo: query.ativo,
    pagination,
  });
  return paginationResult(result.rows, result.total, pagination);
}

export async function get(servicoId, publicOnly = false) {
  const service = await servicoRepository.findService(servicoId);
  if (!service || (publicOnly && !service.ativo)) {
    throw new AppError('Serviço não encontrado.', 404, 'SERVICE_NOT_FOUND');
  }
  return service;
}

export async function create(data) {
  try {
    return await servicoRepository.createService(normalizeService(data));
  } catch (error) {
    throwDuplicateService(error);
  }
}

export async function update(servicoId, data) {
  await get(servicoId);
  try {
    return await servicoRepository.updateService(servicoId, normalizeService(data));
  } catch (error) {
    throwDuplicateService(error);
  }
}

/** Aplica desativação lógica para preservar serviços já referenciados no histórico. */
export async function setStatus(servicoId, ativo) {
  await get(servicoId);
  return servicoRepository.updateServiceStatus(servicoId, ativo);
}
