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
    process.env.BETTER_AUTH_SECRET = 'secret';

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Invalid environment variables:');
    expect(
      errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('DATABASE_URL'),
      ),
    ).toBe(true);
  });

  it('exits(1) and logs the violated constraint when BETTER_AUTH_SECRET is missing', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    delete process.env.BETTER_AUTH_SECRET;

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(
      errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('BETTER_AUTH_SECRET'),
      ),
    ).toBe(true);
  });

  it('does not exit when all required env vars are valid', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.BETTER_AUTH_SECRET = 'secret';
    process.env.PORT = '3000';

    validateEnv();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('exits(1) when PORT is not numeric', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.BETTER_AUTH_SECRET = 'secret';
    process.env.PORT = 'not-a-number';

    validateEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(
      errorSpy.mock.calls.some((call) => String(call[0]).includes('PORT')),
    ).toBe(true);
  });
});
