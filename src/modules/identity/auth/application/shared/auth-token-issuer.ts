import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { UserEntity } from '../../domain/entities/user.entity';
import { RefreshTokenEntity } from '../../domain/entities/refresh-token.entity';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/ports/refresh-token.repository.port';
import type { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token.repository.port';
import { hashToken } from './hash-token';

export type AuthResponse = {
  id: string;
  accessToken: string;
  refreshToken: string;
};

// The refresh JWT's payload — deliberately NO email/name (unlike the access
// token's JwtPayload) so the two token classes are structurally
// distinguishable even if their secrets were ever misconfigured to collide
// (see design.md's "token-confusion defense in depth" ADR and
// JwtAuthGuard's matching payload.type check).
type RefreshJwtPayload = { sub: string; type: 'refresh'; exp: number };

// Dependency rule: application -> domain only, never infrastructure. The
// refresh secret/expiry must be resolved (env read + normalizeJwtExpiry())
// at the infrastructure/module-wiring boundary — the same place
// app.module.ts already does this for the access token's JWT_EXPIRES_IN —
// and handed to this service already-resolved via DI, never read from
// process.env directly in here. See auth.module.ts's REFRESH_JWT_CONFIG
// provider.
export const REFRESH_JWT_CONFIG = Symbol('RefreshJwtConfig');
export type RefreshJwtConfig = {
  secret: string;
  expiresIn: JwtSignOptions['expiresIn'];
};

// Replaces build-auth-response.ts. Promoted to an injectable service (rather
// than a plain function) because it now needs REFRESH_TOKEN_REPOSITORY to
// persist the hashed refresh row — SignUpUseCase, SignInUseCase, and
// RefreshTokenUseCase all consume it identically. Lives under
// application/shared/ (not application/use-cases/) since it isn't itself a
// use case — see AGENTS.md's "Module structure" section.
@Injectable()
export class AuthTokenIssuer {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepositoryPort,
    @Inject(REFRESH_JWT_CONFIG)
    private readonly refreshJwtConfig: RefreshJwtConfig,
  ) {}

  async issue(user: UserEntity): Promise<AuthResponse> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.refreshJwtConfig.secret,
        expiresIn: this.refreshJwtConfig.expiresIn,
        algorithm: 'HS256',
      },
    );

    const decoded = this.jwtService.decode<RefreshJwtPayload>(refreshToken);
    const expiresAt = new Date(decoded.exp * 1000);

    await this.refreshTokenRepository.create(
      new RefreshTokenEntity({
        tokenHash: hashToken(refreshToken),
        userId: user.id!,
        expiresAt,
      }),
    );

    return { id: user.id!, accessToken, refreshToken };
  }
}
