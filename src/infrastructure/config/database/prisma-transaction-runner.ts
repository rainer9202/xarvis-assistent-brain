import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import type {
  TransactionContext,
  TransactionRunner,
} from '@domain/ports/transaction-runner.port';

@Injectable()
export class PrismaTransactionRunner implements TransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (client) => work(client));
  }
}
