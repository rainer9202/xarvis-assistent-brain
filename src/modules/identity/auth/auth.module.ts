import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { normalizeJwtExpiry } from '@config/env/normalize-jwt-expiry';
import { AccountModule } from '@modules/money-manager/account/account.module';
import { CategoryModule } from '@modules/money-manager/category/category.module';
import { GroupModule } from '@modules/money-manager/group/group.module';
import { SignUpUseCase } from './application/use-cases/sign-up.use-case';
import { SignInUseCase } from './application/use-cases/sign-in.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { GetAllUsersUseCase } from './application/use-cases/get-all-users.use-case';
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import {
  AuthTokenIssuer,
  REFRESH_JWT_CONFIG,
} from './application/shared/auth-token-issuer';
import type { RefreshJwtConfig } from './application/shared/auth-token-issuer';
import { DefaultUserDataProvisioner } from './application/shared/default-user-data-provisioner';
import { USER_REPOSITORY } from './domain/ports/user.repository.port';
import { REFRESH_TOKEN_REPOSITORY } from './domain/ports/refresh-token.repository.port';
import { AuthController } from './infrastructure/controllers/auth.controller';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { PrismaRefreshTokenRepository } from './infrastructure/repositories/prisma-refresh-token.repository';

@Module({
  imports: [
    // Scoped to this module only (not global) — /auth/sign-up and
    // /auth/sign-in are the only routes that need rate limiting; every
    // other route in the app is unaffected. Guard is applied directly on
    // AuthController via @UseGuards(ThrottlerGuard). 5 req/60s is a real
    // brute-force deterrent, not a value picked to fit the e2e suite's call
    // count — test/identity/auth.e2e-spec.ts's functional tests each use a
    // unique simulated client IP (X-Forwarded-For, trusted only in the test
    // env — see getTrustedProxies()) so they never share a bucket with each
    // other or with test/auth-rate-limit.e2e-spec.ts's dedicated 429 test,
    // regardless of how many functional tests get added later.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 5 }]),
    // Import the 3 money-manager feature modules purely to inject their
    // exported ProvisionDefault*UseCase into DefaultUserDataProvisioner —
    // AuthModule never touches their repositories directly (see AGENTS.md
    // "Cross-module dependencies").
    AccountModule,
    CategoryModule,
    GroupModule,
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: PrismaRefreshTokenRepository,
    },
    {
      // Raw process.env access + normalizeJwtExpiry() happen here at the
      // module-wiring boundary (same pattern as app.module.ts's JwtModule
      // registration for the access token's JWT_EXPIRES_IN) — AuthTokenIssuer
      // itself (application layer) only ever receives the already-resolved
      // { secret, expiresIn } value via DI, never touching process.env or
      // infrastructure config directly.
      provide: REFRESH_JWT_CONFIG,
      useFactory: (): RefreshJwtConfig => ({
        secret: process.env.REFRESH_JWT_SECRET as string,
        expiresIn: normalizeJwtExpiry(
          process.env.REFRESH_JWT_EXPIRES_IN ?? '30d',
        ) as unknown as RefreshJwtConfig['expiresIn'],
      }),
    },
    AuthTokenIssuer,
    DefaultUserDataProvisioner,
    SignUpUseCase,
    SignInUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    GetAllUsersUseCase,
    GetProfileUseCase,
    UpdateProfileUseCase,
  ],
  exports: [SignUpUseCase, SignInUseCase],
})
export class AuthModule {}
