import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '@config/database/prisma.module';
import { AuthModule } from '@config/auth/auth.module';
import { AuthGuard } from '@shared/guards/auth.guard';
import { MovementTypeModule } from '@modules/money-manager/movement-type/movement-type.module';
import { AccountModule } from '@modules/money-manager/account/account.module';
import { CategoryModule } from '@modules/money-manager/category/category.module';
import { MovementModule } from '@modules/money-manager/movement/movement.module';
import { ReportModule } from '@modules/money-manager/report/report.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MovementTypeModule,
    AccountModule,
    CategoryModule,
    MovementModule,
    ReportModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
