import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaTransactionRunner } from './prisma-transaction-runner';
import { TRANSACTION_RUNNER } from '@domain/ports/transaction-runner.port';

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: TRANSACTION_RUNNER, useClass: PrismaTransactionRunner },
  ],
  exports: [PrismaService, TRANSACTION_RUNNER],
})
export class PrismaModule {}
