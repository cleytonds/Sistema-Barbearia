import { pool } from '../../config/database.js';
import { grantRole, hasRole, VALID_ROLES } from '../../repositories/roleRepository.js';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Defina a variável de ambiente ${name}.`);
  return value;
}

async function main() {
  const userId = required('ROLE_USER_ID');
  const role = required('ROLE_NAME').toLowerCase();
  const expectedEmail = required('ROLE_EXPECTED_EMAIL').toLowerCase();
  const expectedName = required('ROLE_EXPECTED_NAME');
  const expectedBarberId = process.env.ROLE_EXPECTED_BARBER_ID?.trim();
  if (!/^\d+$/.test(userId) || !VALID_ROLES.includes(role))
    throw new Error('Parâmetros inválidos.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[user]] = await connection.execute(
      'SELECT id,nome,email,perfil,ativo FROM usuarios WHERE id=? FOR UPDATE',
      [userId],
    );
    if (
      !user ||
      !user.ativo ||
      user.nome !== expectedName ||
      user.email.toLowerCase() !== expectedEmail
    )
      throw new Error('A identidade esperada não confere.');
    if (role === 'admin' && user.perfil === 'barbeiro') {
      const [[barber]] = await connection.execute(
        'SELECT id,ativo FROM barbeiros WHERE usuario_id=? FOR UPDATE',
        [userId],
      );
      if (!barber?.ativo || (expectedBarberId && String(barber.id) !== expectedBarberId))
        throw new Error('Perfil profissional esperado não confere.');
      if (!(await hasRole(userId, 'barbeiro', connection)))
        throw new Error('O papel barbeiro precisa ser preservado.');
    }
    const inserted = await grantRole(userId, role, connection);
    if (inserted)
      await connection.execute('UPDATE usuarios SET auth_versao=auth_versao+1 WHERE id=?', [
        userId,
      ]);
    await connection.commit();
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'role_granted',
        usuarioId: userId,
        papel: role,
        changed: inserted,
      }),
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`[roles] falha: ${error.message}`);
  process.exitCode = 1;
});
