import { Module } from '@nestjs/common';
import { AccountModule } from '@modules/money-manager/account/account.module';
import { GetBalanceReportUseCase } from './application/use-cases/get-balance-report.use-case';
import { ReportController } from './infrastructure/controllers/report.controller';

@Module({
  imports: [AccountModule],
  controllers: [ReportController],
  providers: [GetBalanceReportUseCase],
})
export class ReportModule {}
