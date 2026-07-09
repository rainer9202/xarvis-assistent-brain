// class-transformer's plainToInstance() needs Reflect.getMetadata to read
// design:type metadata, normally polyfilled as a side effect of Nest's own
// bootstrap chain in the real app — imported explicitly here since this spec
// exercises validateEnv() standalone, outside that chain.
import 'reflect-metadata';
import { validateEnv } from './validate-env';

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

    validateEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('exits(1) when PORT is not numeric', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.PORT = 'not-a-number';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';

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

    validateEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('exits(1) and logs the violated constraint when JWT_EXPIRES_IN is a malformed duration string', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.JWT_EXPIRES_IN = 'not-a-duration';

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

      validateEnv();

      expect(exitSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    },
  );
});
