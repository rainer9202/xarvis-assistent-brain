import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { PrismaModule } from '@config/database/prisma.module';
import { MovementTypeModule } from '@modules/money-manager/movement-type/movement-type.module';
import { AccountModule } from '@modules/money-manager/account/account.module';
import { CategoryModule } from '@modules/money-manager/category/category.module';
import { MovementModule } from '@modules/money-manager/movement/movement.module';
import { ReportModule } from '@modules/money-manager/report/report.module';
import { AuthModule } from '@modules/identity/auth/auth.module';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { normalizeJwtExpiry } from '@config/env/normalize-jwt-expiry';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // global: true so JwtService is injectable everywhere (JwtAuthGuard and
    // the identity/auth use cases) without every module re-importing it.
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        // Explicit HS256 allow-list on both sides, even though jsonwebtoken
        // already defaults to HS256 when signing with a plain string secret
        // — explicit is safer than relying on that default never changing,
        // and it closes off an algorithm-confusion attack on verify.
        signOptions: {
          algorithm: 'HS256',
          // `expiresIn`'s real type is `jsonwebtoken`'s `StringValue` (the
          // `ms` package's template-literal type), which isn't resolvable
          // from this project's own node_modules under pnpm's strict linking
          // — only `@nestjs/jwt`'s own nested copy sees it. Double-assert
          // through `@nestjs/jwt`'s own exported `JwtSignOptions` (a direct
          // dependency) instead of a bare `as any`, so this stays a typed
          // cast rather than an unsafe-assignment lint violation.
          //
          // normalizeJwtExpiry() guards against jsonwebtoken/ms silently
          // treating a bare-digit string (e.g. "3600") as MILLISECONDS
          // instead of the seconds our own env validation message promises
          // — see src/config/env/normalize-jwt-expiry.ts.
          expiresIn: normalizeJwtExpiry(
            process.env.JWT_EXPIRES_IN ?? '2h',
          ) as unknown as JwtSignOptions['expiresIn'],
        },
        verifyOptions: {
          algorithms: ['HS256'],
        },
      }),
    }),
    PrismaModule,
    MovementTypeModule,
    AccountModule,
    CategoryModule,
    MovementModule,
    ReportModule,
    AuthModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
