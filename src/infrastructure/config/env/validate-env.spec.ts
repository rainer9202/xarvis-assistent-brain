// class-transformer's plainToInstance() needs Reflect.getMetadata to read
// design:type metadata, normally polyfilled as a side effect of Nest's own
// bootstrap chain in the real app — imported explicitly here since this spec
// exercises validateEnv() standalone, outside that chain.
import 'reflect-metadata';
import { validateEnv } from './validate-env';

// Valid, distinct-from-JWT_SECRET refresh secret shared by every test in
// this file that isn't specifically exercising REFRESH_JWT_SECRET's own
// validation, so those tests stay isolated to the concern they name.
const VALID_REFRESH_JWT_SECRET = 'test-refresh-secret-with-at-least-32-chars';

describe('validateEnv', () => {
  const originalEnv = process.env;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;
  let errorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('exits(1) and logs the violated constraint when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Invalid environment variables:');
    expect(
      errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('DATABASE_URL'),
      ),
    ).toBe(true);
  });

  it('does not exit when all required env vars are valid', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.PORT = '3000';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.REFRESH_JWT_SECRET = VALID_REFRESH_JWT_SECRET;

    validateEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('exits(1) when PORT is not numeric', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.PORT = 'not-a-number';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.REFRESH_JWT_SECRET = VALID_REFRESH_JWT_SECRET;

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(
      errorSpy.mock.calls.some((call) => String(call[0]).includes('PORT')),
    ).toBe(true);
  });

  it('exits(1) and logs the violated constraint when JWT_SECRET is missing', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    delete process.env.JWT_SECRET;

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(
      errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('JWT_SECRET'),
      ),
    ).toBe(true);
  });

  it('exits(1) and logs the violated constraint when JWT_SECRET is shorter than 32 characters', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.JWT_SECRET = 'too-short-secret';

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(
      errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('JWT_SECRET'),
      ),
    ).toBe(true);
  });

  it('does not exit when JWT_EXPIRES_IN is a valid duration string', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.JWT_EXPIRES_IN = '2h';
    process.env.REFRESH_JWT_SECRET = VALID_REFRESH_JWT_SECRET;

    validateEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('exits(1) and logs the violated constraint when JWT_EXPIRES_IN is a malformed duration string', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.JWT_EXPIRES_IN = 'not-a-duration';
    process.env.REFRESH_JWT_SECRET = VALID_REFRESH_JWT_SECRET;

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(
      errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('JWT_EXPIRES_IN'),
      ),
    ).toBe(true);
  });

  // JWT_DURATION_PATTERN boundary cases: these all pass the env-boot
  // validation regex, but only normalizeJwtExpiry() (see
  // normalize-jwt-expiry.spec.ts) actually makes a bare integer mean real
  // seconds once it reaches jsonwebtoken. This suite only proves these
  // formats pass validation, not runtime expiry behavior.
  it.each(['3600', '1.5h', '10 m', '0'])(
    'does not exit when JWT_EXPIRES_IN is the boundary format %p',
    (value) => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
      process.env.JWT_EXPIRES_IN = value;
      process.env.REFRESH_JWT_SECRET = VALID_REFRESH_JWT_SECRET;

      validateEnv();

      expect(exitSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    },
  );

  it('exits(1) and logs the violated constraint when REFRESH_JWT_SECRET is missing', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    delete process.env.REFRESH_JWT_SECRET;

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(
      errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('REFRESH_JWT_SECRET'),
      ),
    ).toBe(true);
  });

  it('exits(1) and logs the violated constraint when REFRESH_JWT_SECRET is shorter than 32 characters', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.REFRESH_JWT_SECRET = 'too-short-refresh-secret';

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(
      errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('REFRESH_JWT_SECRET'),
      ),
    ).toBe(true);
  });

  // The token-confusion defense-in-depth boot check (see
  // is-distinct-from.validator.spec.ts and design.md): REFRESH_JWT_SECRET
  // must never equal JWT_SECRET, even though both independently satisfy
  // @MinLength(32) on their own.
  it('exits(1) and logs the violated constraint when REFRESH_JWT_SECRET equals JWT_SECRET', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.REFRESH_JWT_SECRET = 'test-secret-with-at-least-32-characters';

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(
      errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('REFRESH_JWT_SECRET'),
      ),
    ).toBe(true);
  });

  it('does not exit when REFRESH_JWT_SECRET is valid and REFRESH_JWT_EXPIRES_IN is omitted (defaults to 30d at sign time)', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.REFRESH_JWT_SECRET = VALID_REFRESH_JWT_SECRET;
    delete process.env.REFRESH_JWT_EXPIRES_IN;

    validateEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('exits(1) and logs the violated constraint when REFRESH_JWT_EXPIRES_IN is a malformed duration string', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.REFRESH_JWT_SECRET = VALID_REFRESH_JWT_SECRET;
    process.env.REFRESH_JWT_EXPIRES_IN = 'not-a-duration';

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(
      errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('REFRESH_JWT_EXPIRES_IN'),
      ),
    ).toBe(true);
  });

  it('does not exit when REFRESH_JWT_EXPIRES_IN is a valid duration string', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.REFRESH_JWT_SECRET = VALID_REFRESH_JWT_SECRET;
    process.env.REFRESH_JWT_EXPIRES_IN = '30d';

    validateEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
