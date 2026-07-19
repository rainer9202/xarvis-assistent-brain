import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../../domain/entities/user.entity';
import { RefreshTokenEntity } from '../../domain/entities/refresh-token.entity';
import type { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token.repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';
import { AuthTokenIssuer } from '../shared/auth-token-issuer';
import type {
  AuthResponse,
  RefreshJwtConfig,
} from '../shared/auth-token-issuer';
import {
  RefreshTokenCommand,
  RefreshTokenUseCase,
} from './refresh-token.use-case';

describe('RefreshTokenUseCase', () => {
  let verifyAsync: jest.Mock;
  let jwtService: JwtService;
  let findByHash: jest.Mock;
  let revoke: jest.Mock;
  let refreshTokenRepository: RefreshTokenRepositoryPort;
  let findById: jest.Mock;
  let userRepository: UserRepositoryPort;
  let issue: jest.Mock;
  let authTokenIssuer: AuthTokenIssuer;
  let refreshJwtConfig: RefreshJwtConfig;
  let useCase: RefreshTokenUseCase;

  const storedUser = new UserEntity({
    id: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'hashed',
  });

  beforeEach(() => {
    verifyAsync = jest.fn();
    jwtService = { verifyAsync } as unknown as JwtService;

    findByHash = jest.fn();
    revoke = jest.fn().mockResolvedValue(undefined);
    refreshTokenRepository = {
      create: jest.fn(),
      findByHash,
      revoke,
      revokeByHash: jest.fn(),
    };

    findById = jest.fn();
    userRepository = {
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      findById,
      update: jest.fn(),
    };

    issue = jest.fn();
    authTokenIssuer = { issue } as unknown as AuthTokenIssuer;

    refreshJwtConfig = {
      secret: 'test-refresh-secret-with-at-least-32-chars',
      expiresIn: '30d',
    };

    useCase = new RefreshTokenUseCase(
      jwtService,
      refreshTokenRepository,
      userRepository,
      refreshJwtConfig,
      authTokenIssuer,
    );
  });

  it('rotates a valid refresh token: revokes the old row and issues a new pair via AuthTokenIssuer', async () => {
    verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'refresh' });
    const storedToken = new RefreshTokenEntity({
      id: 'token-1',
      tokenHash: 'irrelevant-in-this-test',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: null,
    });
    findByHash.mockResolvedValue(storedToken);
    findById.mockResolvedValue(storedUser);
    const newAuthResponse: AuthResponse = {
      id: 'user-1',
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    };
    issue.mockResolvedValue(newAuthResponse);

    const result = await useCase.execute(
      new RefreshTokenCommand('valid-refresh-jwt'),
    );

    expect(verifyAsync).toHaveBeenCalledWith('valid-refresh-jwt', {
      secret: 'test-refresh-secret-with-at-least-32-chars',
      algorithms: ['HS256'],
    });
    expect(revoke).toHaveBeenCalledWith(storedToken);
    expect(issue).toHaveBeenCalledWith(storedUser);
    expect(result).toEqual(newAuthResponse);
  });

  it('throws UnauthorizedException when the token is malformed or expired (jwtService.verifyAsync throws)', async () => {
    verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(
      useCase.execute(new RefreshTokenCommand('expired-or-malformed-jwt')),
    ).rejects.toThrow(UnauthorizedException);
    expect(findByHash).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the token payload is not a refresh-type token', async () => {
    verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'jane@example.com' });

    await expect(
      useCase.execute(
        new RefreshTokenCommand('an-access-token-used-as-refresh'),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(findByHash).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when no stored row matches the presented token (unknown token)', async () => {
    verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'refresh' });
    findByHash.mockResolvedValue(null);

    await expect(
      useCase.execute(new RefreshTokenCommand('unknown-refresh-jwt')),
    ).rejects.toThrow(UnauthorizedException);
    expect(revoke).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException on reuse of an already-revoked token, same 401 shape as unknown, and defensively re-revokes (no-op, not an error)', async () => {
    verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'refresh' });
    const alreadyRevokedToken = new RefreshTokenEntity({
      id: 'token-1',
      tokenHash: 'irrelevant-in-this-test',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: new Date(Date.now() - 1000 * 60),
    });
    findByHash.mockResolvedValue(alreadyRevokedToken);

    await expect(
      useCase.execute(new RefreshTokenCommand('already-revoked-refresh-jwt')),
    ).rejects.toThrow(UnauthorizedException);
    expect(revoke).toHaveBeenCalledWith(alreadyRevokedToken);
    expect(issue).not.toHaveBeenCalled();
  });
});
