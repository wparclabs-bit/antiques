// Shared vitest constants, so the config and the global setup agree.
// Override on the command line for a different test database:
//   TEST_DATABASE_URL=... npm test
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://antiques:antiques@localhost:5432/antiques_test";
