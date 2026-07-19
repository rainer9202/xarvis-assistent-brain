import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../../domain/entities/user.entity';
import { RefreshTokenEntity } from '../../domain/entities/refresh-token.entity';
import type { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token.repository.port';
import { hashToken } from './hash-token';
import { AuthTokenIssuer } from './auth-token-issuer';
import type { RefreshJwtConfig } from './auth-token-issuer';

describe('AuthTokenIssuer', () => {
  let signAsync: jest.Mock;
  let decode: jest.Mock;
  let jwtService: JwtService;
  let create: jest.Mock;
  let repository: RefreshTokenRepositoryPort;
  let refreshJwtConfig: RefreshJwtConfig;
  let issuer: AuthTokenIssuer;

  beforeEach(() => {
    signAsync = jest.fn();
    decode = jest.fn();
    jwtService = { signAsync, decode } as unknown as JwtService;

    create = jest.fn().mockResolvedValue(undefined);
    repository = {
      create,
      findByHash: jest.fn(),
      revoke: jest.fn(),
      revokeByHash: jest.fn(),
    };

    // AuthTokenIssuer (application layer) only ever receives an
    // already-resolved config value via DI — it never reads process.env or
    // normalizes the expiry itself (that happens at auth.module.ts's
    // wiring boundary). This mirrors that contract directly.
    refreshJwtConfig = {
      secret: 'test-refresh-secret-with-at-least-32-chars',
      expiresIn: '30d',
    };

    issuer = new AuthTokenIssuer(jwtService, repository, refreshJwtConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('issues an access token with the existing {sub, email, name} shape and a refresh token, persisting the hashed refresh row', async () => {
    signAsync.mockImplementation(
      (payload: Record<string, unknown>, options?: { secret?: string }) => {
        if (options?.secret) return Promise.resolve('signed-refresh-jwt');
        return Promise.resolve('signed-access-jwt');
      },
    );
    const expSeconds = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    decode.mockReturnValue({ sub: 'user-1', type: 'refresh', exp: expSeconds });

    const user = new UserEntity({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'hashed',
    });

    let persistedEntity: RefreshTokenEntity | undefined;
    create.mockImplementation((entity: RefreshTokenEntity) => {
      persistedEntity = entity;
      return Promise.resolve();
    });

    const result = await issuer.issue(user);

    expect(signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    });
    expect(signAsync).toHaveBeenCalledWith(
      { sub: 'user-1', type: 'refresh', jti: expect.any(String) as string },
      {
        secret: 'test-refresh-secret-with-at-least-32-chars',
        expiresIn: '30d',
        algorithm: 'HS256',
      },
    );
    expect(create).toHaveBeenCalledWith(expect.any(RefreshTokenEntity));
    expect(persistedEntity?.tokenHash).toBe(hashToken('signed-refresh-jwt'));
    expect(persistedEntity?.userId).toBe('user-1');
    expect(persistedEntity?.expiresAt).toEqual(new Date(expSeconds * 1000));
    expect(result).toEqual({
      id: 'user-1',
      accessToken: 'signed-access-jwt',
      refreshToken: 'signed-refresh-jwt',
    });
  });

  it('signs the refresh token using whatever expiresIn the injected config carries (e.g. a non-default value)', async () => {
    refreshJwtConfig.expiresIn = '7d';
    issuer = new AuthTokenIssuer(jwtService, repository, refreshJwtConfig);
    signAsync.mockImplementation(
      (payload: Record<string, unknown>, options?: { secret?: string }) => {
        if (options?.secret) return Promise.resolve('signed-refresh-jwt');
        return Promise.resolve('signed-access-jwt');
      },
    );
    decode.mockReturnValue({
      sub: 'user-1',
      type: 'refresh',
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    });

    const user = new UserEntity({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'hashed',
    });

    await issuer.issue(user);

    expect(signAsync).toHaveBeenCalledWith(
      { sub: 'user-1', type: 'refresh', jti: expect.any(String) as string },
      {
        secret: 'test-refresh-secret-with-at-least-32-chars',
        expiresIn: '7d',
        algorithm: 'HS256',
      },
    );
  });

  it('🔍 gives each issued refresh token a distinct jti, so two tokens issued for the same user within the same second never collide on tokenHash', async () => {
    signAsync.mockImplementation(
      (payload: Record<string, unknown>, options?: { secret?: string }) => {
        if (options?.secret)
          return Promise.resolve(`signed-refresh-${payload.jti as string}`);
        return Promise.resolve('signed-access-jwt');
      },
    );
    decode.mockReturnValue({
      sub: 'user-1',
      type: 'refresh',
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    });

    const user = new UserEntity({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'hashed',
    });

    await issuer.issue(user);
    await issuer.issue(user);

    const refreshCalls = signAsync.mock.calls.filter(
      ([, options]: [unknown, { secret?: string } | undefined]) =>
        options?.secret,
    );
    expect(refreshCalls).toHaveLength(2);

    const [firstPayload] = refreshCalls[0] as [Record<string, unknown>];
    const [secondPayload] = refreshCalls[1] as [Record<string, unknown>];

    expect(firstPayload.jti).toEqual(expect.any(String));
    expect(secondPayload.jti).toEqual(expect.any(String));
    expect(firstPayload.jti).not.toEqual(secondPayload.jti);
  });
});
