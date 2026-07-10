// `jsonwebtoken` (via `@nestjs/jwt`'s `JwtModule.registerAsync` factory in
// `app.module.ts`) calls the `ms` package on ANY string passed as
// `signOptions.expiresIn` — `ms('3600')` returns 3600 *milliseconds* because
// there's no unit suffix, not 3600 seconds. `environment-variables.ts`'s
// `JWT_DURATION_PATTERN` and its validation message document a bare integer
// as meaning "seconds," so without this normalization step a real
// `JWT_EXPIRES_IN=3600` would silently expire every token in ~3.6s instead of
// 1h. Call this at the point `JWT_EXPIRES_IN` is consumed, before it reaches
// `signOptions.expiresIn`.
export function normalizeJwtExpiry(value: string): string {
  return /^\d+(\.\d+)?$/.test(value) ? `${value}s` : value;
}
