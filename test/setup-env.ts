// e2e tests must never depend on the project's own .env (which may point at
// a real remote database). Force the local docker-compose db unless the
// runner explicitly overrides it (e.g. in CI).
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/xarvis_brain?schema=public';
// Better-Auth was fully replaced by hand-rolled JWT auth (@nestjs/jwt +
// argon2) — JWT_SECRET/JWT_EXPIRES_IN are the only auth-related env vars now.
process.env.JWT_SECRET ??= 'test-secret-not-for-production-use-only';
process.env.JWT_EXPIRES_IN ??= '2h';
// e2e specs connect to the app over loopback (supertest -> app.getHttpServer()),
// so trusting the 'loopback' preset (not the production RFC1918 default —
// see getTrustedProxies()) lets test/identity/auth.e2e-spec.ts's functional
// tests each simulate a unique client IP via X-Forwarded-For. This keeps
// each test in its own @nestjs/throttler bucket (keyed by class+handler+IP)
// so they never collide with each other or with the dedicated 429 test in
// test/auth-rate-limit.e2e-spec.ts, regardless of how many get added later.
process.env.TRUSTED_PROXIES ??= 'loopback';
