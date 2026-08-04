import bcrypt from 'bcryptjs';

export const BCRYPT_COST = 12;
const dummyHashPromise = bcrypt.hash('dummy-password-not-used-123', BCRYPT_COST);

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function compareWithDummyHash(password) {
  return bcrypt.compare(password, await dummyHashPromise);
}
