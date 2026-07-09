import { getTrustedProxies } from './get-trusted-proxies';

// Extracted so main.ts's `app.set('trust proxy', ...)` wiring stays a thin
// one-liner while the actual parsing (comma-separated env var, default
// RFC1918 ranges) is unit-testable in isolation. Mirrors the same
// split/trim/filter pattern CORS_ORIGINS already uses.
describe('getTrustedProxies', () => {
  const originalEnv = process.env.TRUSTED_PROXIES;

  afterEach(() => {
    process.env.TRUSTED_PROXIES = originalEnv;
  });

  it('defaults to the standard RFC1918 private ranges when unset', () => {
    delete process.env.TRUSTED_PROXIES;

    expect(getTrustedProxies()).toEqual([
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
    ]);
  });

  it('parses a comma-separated TRUSTED_PROXIES into a trimmed, non-empty list', () => {
    process.env.TRUSTED_PROXIES = ' 203.0.113.5 , 198.51.100.0/24,';

    expect(getTrustedProxies()).toEqual(['203.0.113.5', '198.51.100.0/24']);
  });

  it('returns an empty array when TRUSTED_PROXIES is explicitly set but blank', () => {
    // Explicit empty string is NOT the same as unset (`??` only falls back
    // on null/undefined) — an operator who explicitly sets an empty value
    // means "trust no proxies," not "use the default."
    process.env.TRUSTED_PROXIES = '';

    expect(getTrustedProxies()).toEqual([]);
  });
});
