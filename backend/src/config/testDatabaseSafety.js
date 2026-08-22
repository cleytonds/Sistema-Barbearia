export function assertSafeTestDatabase(nodeEnv, databaseName) {
  if (nodeEnv === 'test' && !String(databaseName ?? '').endsWith('_test')) {
    throw new Error('Refusing test execution against non-test database.');
  }
}
