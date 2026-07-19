import { Inject, Injectable } from '@nestjs/common';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/ports/refresh-token.repository.port';
import type { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token.repository.port';
import { hashToken } from '../shared/hash-token';

export class LogoutCommand {
  constructor(public readonly refreshToken: string) {}
}

// No JWT verification here (unlike RefreshTokenUseCase) — design.md's data
// flow for logout is just sha256 -> repo.revokeByHash. Authority to log out
// is simple possession of the refresh token string, not a live access
// token, so a client can log out after its access token has already
// expired (see spec's "Revoke a refresh token via logout" requirement).
// revokeByHash() is itself idempotent (a Prisma updateMany matching zero
// rows is a silent no-op, never a throw), so an unknown or already-revoked
// token resolves exactly the same way as a valid one — 200, no error.
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly repository: RefreshTokenRepositoryPort,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    await this.repository.revokeByHash(hashToken(command.refreshToken));
  }
}
