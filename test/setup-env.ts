// e2e tests must never depend on the project's own .env (which may point at
// a real remote database). Force the local docker-compose db unless the
// runner explicitly overrides it (e.g. in CI).
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/xarvis_brain?schema=public';
process.env.BETTER_AUTH_SECRET ??= 'test-secret-not-for-production-use-only';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
