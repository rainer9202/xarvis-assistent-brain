import type { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token.repository.port';
import { hashToken } from '../shared/hash-token';
import { LogoutCommand, LogoutUseCase } from './logout.use-case';

describe('LogoutUseCase', () => {
  let revokeByHash: jest.Mock;
  let repository: RefreshTokenRepositoryPort;
  let useCase: LogoutUseCase;

  beforeEach(() => {
    revokeByHash = jest.fn().mockResolvedValue(undefined);
    repository = {
      create: jest.fn(),
      findByHash: jest.fn(),
      revoke: jest.fn(),
      revokeByHash,
    };

    useCase = new LogoutUseCase(repository);
  });

  it('revokes the refresh token by its hash', async () => {
    await useCase.execute(new LogoutCommand('some-refresh-jwt'));

    expect(revokeByHash).toHaveBeenCalledWith(hashToken('some-refresh-jwt'));
  });

  it('is idempotent — an already-revoked or unknown token resolves without throwing (revokeByHash is itself a no-op at the repository layer)', async () => {
    // revokeByHash is a no-op Prisma updateMany when zero rows match — this
    // test proves LogoutUseCase never adds an existence check on top of
    // that, which would break the idempotency contract.
    revokeByHash.mockResolvedValue(undefined);

    await expect(
      useCase.execute(new LogoutCommand('unknown-or-already-revoked-token')),
    ).resolves.toBeUndefined();
    expect(revokeByHash).toHaveBeenCalledWith(
      hashToken('unknown-or-already-revoked-token'),
    );
  });
});
