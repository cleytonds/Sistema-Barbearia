import bcrypt from 'bcryptjs';
import { pool } from '../../config/database.js';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Defina a variável de ambiente ${name}.`);
  return value;
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function normalizePhone(value) {
  return value.replace(/\D/g, '');
}

async function main() {
  const name = required('ADMIN_NAME');
  const email = normalizeEmail(required('ADMIN_EMAIL'));
  const phone = normalizePhone(required('ADMIN_PHONE'));
  const password = required('ADMIN_PASSWORD');

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('ADMIN_EMAIL inválido.');
  if (phone.length < 10 || phone.length > 15) throw new Error('ADMIN_PHONE deve conter entre 10 e 15 dígitos.');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('ADMIN_PASSWORD deve ter ao menos 8 caracteres, uma letra e um número.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[existing]] = await connection.execute(
      'SELECT id FROM usuarios WHERE email = ? OR telefone = ? LIMIT 1 FOR UPDATE',
      [email, phone]
    );
    if (existing) throw new Error('Já existe um usuário com o e-mail ou telefone informado.');

    const [result] = await connection.execute(
      `INSERT INTO usuarios (nome, email, telefone, senha_hash, perfil, ativo)
       VALUES (?, ?, ?, ?, 'admin', TRUE)`,
      [name, email, phone, passwordHash]
    );
    await connection.commit();
    console.log(`[admin] administrador criado com id ${result.insertId}.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`[admin] falha: ${error.message}`);
  process.exitCode = 1;
});

