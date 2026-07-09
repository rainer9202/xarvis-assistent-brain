import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SignUpUseCase } from './application/use-cases/sign-up.use-case';
import { SignInUseCase } from './application/use-cases/sign-in.use-case';
import { USER_REPOSITORY } from './domain/ports/user.repository.port';
import { AuthController } from './infrastructure/controllers/auth.controller';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';

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
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    SignUpUseCase,
    SignInUseCase,
  ],
  exports: [SignUpUseCase, SignInUseCase],
})
export class AuthModule {}
