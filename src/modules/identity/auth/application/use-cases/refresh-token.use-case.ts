import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/ports/refresh-token.repository.port';
import type { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token.repository.port';
import { USER_REPOSITORY } from '../../domain/ports/user.repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  AuthTokenIssuer,
  REFRESH_JWT_CONFIG,
} from '../shared/auth-token-issuer';
import type {
  AuthResponse,
  RefreshJwtConfig,
} from '../shared/auth-token-issuer';
import { hashToken } from '../shared/hash-token';

export type RefreshTokenResponse = AuthResponse;

// Mirrors AuthTokenIssuer's RefreshJwtPayload shape — deliberately no
// email/name, see design.md's "token-confusion defense in depth" ADR.
type RefreshJwtPayload = { sub: string; type: string };

export class RefreshTokenCommand {
  constructor(public readonly refreshToken: string) {}
}

// Data flow (design.md): verify JWT(secret=REFRESH_JWT_SECRET) fail->401;
// payload.type !== 'refresh' -> 401; sha256 -> repo.findByHash null -> 401;
// revokedAt set -> re-revoke (no-op) -> 401 (reuse, same shape as unknown);
// valid -> revoke old -> AuthTokenIssuer.issue(user) -> {id, accessToken,
// refreshToken}. Every rejection path throws the identical
// UnauthorizedException so an attacker can't distinguish "unknown token"
// from "reused token" from "malformed token" by response shape.
@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(REFRESH_JWT_CONFIG)
    private readonly refreshJwtConfig: RefreshJwtConfig,
    private readonly authTokenIssuer: AuthTokenIssuer,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResponse> {
    let payload: RefreshJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshJwtPayload>(
        command.refreshToken,
        { secret: this.refreshJwtConfig.secret, algorithms: ['HS256'] },
      );
    } catch {
      // Covers malformed tokens, bad signatures, and expired tokens
      // (jsonwebtoken's own exp-claim check) in one place.
      throw new UnauthorizedException();
    }

    if (payload.type !== 'refresh') {
      // A verified-but-wrong-shape token (e.g. an access token presented
      // here) — holds even if REFRESH_JWT_SECRET and JWT_SECRET ever
      // collided, since the check is on payload shape, not signature.
      throw new UnauthorizedException();
    }

    const tokenHash = hashToken(command.refreshToken);
    const storedToken = await this.refreshTokenRepository.findByHash(tokenHash);
    if (!storedToken) {
      throw new UnauthorizedException();
    }

    if (storedToken.revokedAt) {
      // Reuse of an already-exchanged/revoked token: defensively re-revoke
      // (idempotent, never throws) so the row's revoked state is
      // reaffirmed, then reject with the exact same shape as an unknown
      // token — a reused token must not be distinguishable from a token
      // that never existed.
      await this.refreshTokenRepository.revoke(storedToken);
      throw new UnauthorizedException();
    }

    const user = await this.userRepository.findById(storedToken.userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    await this.refreshTokenRepository.revoke(storedToken);

    return this.authTokenIssuer.issue(user);
  }
}
