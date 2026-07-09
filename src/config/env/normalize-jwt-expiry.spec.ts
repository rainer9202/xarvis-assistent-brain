import { JwtService } from '@nestjs/jwt';
import { normalizeJwtExpiry } from './normalize-jwt-expiry';

// jsonwebtoken's `timespan()` calls the `ms` package on ANY string value for
// `expiresIn` — `ms('3600')` resolves to 3600 *milliseconds* (no unit
// suffix), not 3600 seconds, so a bare-digit `JWT_EXPIRES_IN` silently
// expires tokens in ~3.6s instead of 1h. These specs sign through the real
// `@nestjs/jwt` -> `jsonwebtoken` path (not a string-equality check) so a
// regression here is caught even if the internal `ms` behavior ever changes.
describe('normalizeJwtExpiry', () => {
  function realSecondsUntilExpiry(expiresIn: string): number {
    const jwtService = new JwtService({ secret: 'unit-test-secret' });
    const token = jwtService.sign(
      { sub: 'user-1' },
      { expiresIn: expiresIn as never },
    );
    const decoded = jwtService.decode<{ iat: number; exp: number }>(token);
    return decoded.exp - decoded.iat;
  }

  it('makes a bare-integer string mean real seconds, not milliseconds', () => {
    const rawBareInteger = '3600';

    // Un-normalized: jsonwebtoken/ms treats '3600' as 3600ms => ~4 real
    // seconds of validity, proving the bug this helper fixes.
    expect(realSecondsUntilExpiry(rawBareInteger)).toBeLessThan(10);

    // Normalized: appending 's' makes it explicit duration seconds.
    const normalized = normalizeJwtExpiry(rawBareInteger);
    expect(realSecondsUntilExpiry(normalized)).toBe(3600);
  });

  it('appends "s" to a bare integer string', () => {
    expect(normalizeJwtExpiry('3600')).toBe('3600s');
  });

  it('appends "s" to a bare decimal string', () => {
    expect(normalizeJwtExpiry('1.5')).toBe('1.5s');
  });

  it('leaves an already unit-suffixed duration string untouched', () => {
    expect(normalizeJwtExpiry('2h')).toBe('2h');
    expect(normalizeJwtExpiry('10m')).toBe('10m');
    expect(normalizeJwtExpiry('1.5h')).toBe('1.5h');
    expect(normalizeJwtExpiry('10 m')).toBe('10 m');
  });

  it('appends "s" to "0" (still a valid, zero-length duration)', () => {
    expect(normalizeJwtExpiry('0')).toBe('0s');
  });
});
