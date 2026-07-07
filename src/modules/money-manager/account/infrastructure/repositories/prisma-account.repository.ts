import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { AccountEntity } from '../../domain/entities/account.entity';
import type {
  AccountBalance,
  AccountRepositoryPort,
} from '../../domain/ports/account.repository.port';
import { AccountModel } from '@config/database/generated/prisma/models.js';
import type { Prisma } from '@config/database/generated/prisma/client.js';

// Decimal is a LOCAL alias, imported ONLY here in infra — the domain layer
// never sees Prisma's Decimal, only the integer cents this repository maps to.
type Decimal = Prisma.Decimal;

// The only MovementType name that flips balance sign for regular (non-transfer)
// movements; income adds. Transfer movements are handled separately below —
// they move money between two accounts and are never counted as income/expense.
const EXPENSE_TYPE_NAME = 'expense';
const TRANSFER_TYPE_NAME = 'transfer';

@Injectable()
export class PrismaAccountRepository implements AccountRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<AccountEntity[]> {
    const records = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string, userId: string): Promise<AccountEntity | null> {
    const record = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    return record ? this.toEntity(record) : null;
  }

  async save(entity: AccountEntity): Promise<AccountEntity> {
    const record = await this.prisma.account.create({
      data: {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        userId: entity.userId,
        isActive: entity.isActive,
      },
    });

    return this.toEntity(record);
  }

  async update(entity: AccountEntity): Promise<AccountEntity> {
    const record = await this.prisma.account.update({
      where: { id: entity.id! },
      data: {
        name: entity.name,
        type: entity.type,
        isActive: entity.isActive,
      },
    });

    return this.toEntity(record);
  }

  async delete(entity: AccountEntity): Promise<void> {
    await this.prisma.account.delete({ where: { id: entity.id! } });
  }

  async countMovementsByAccountId(accountId: string): Promise<number> {
    return this.prisma.movement.count({
      where: { OR: [{ accountId }, { toAccountId: accountId }] },
    });
  }

  async findByIdWithBalance(
    id: string,
    userId: string,
  ): Promise<AccountBalance | null> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!account) return null;

    const { typeNameById, transferTypeId } = await this.loadTransferContext();
    let balanceCents = 0;

    const nonTransferSums = await this.prisma.movement.groupBy({
      by: ['movementTypeId'],
      where: {
        accountId: id,
        ...(transferTypeId ? { movementTypeId: { not: transferTypeId } } : {}),
      },
      _sum: { amount: true },
    });
    for (const sum of nonTransferSums) {
      const cents = sum._sum.amount ? this.amountToCents(sum._sum.amount) : 0;
      const sign =
        typeNameById.get(sum.movementTypeId) === EXPENSE_TYPE_NAME ? -1 : 1;
      balanceCents += sign * cents;
    }

    if (transferTypeId) {
      const [transfersOut, transfersIn] = await Promise.all([
        this.prisma.movement.aggregate({
          where: { accountId: id, movementTypeId: transferTypeId },
          _sum: { amount: true },
        }),
        this.prisma.movement.aggregate({
          where: { toAccountId: id, movementTypeId: transferTypeId },
          _sum: { amount: true },
        }),
      ]);
      if (transfersOut._sum.amount)
        balanceCents -= this.amountToCents(transfersOut._sum.amount);
      if (transfersIn._sum.amount)
        balanceCents += this.amountToCents(transfersIn._sum.amount);
    }

    return { account: this.toEntity(account), balanceCents };
  }

  async findAllWithBalance(userId: string): Promise<AccountBalance[]> {
    const [accounts, { typeNameById, transferTypeId }] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.loadTransferContext(),
    ]);
    const accountIds = accounts.map((account) => account.id);

    const balanceByAccountId = new Map<string, number>();
    const addToBalance = (accountId: string, cents: number) => {
      balanceByAccountId.set(
        accountId,
        (balanceByAccountId.get(accountId) ?? 0) + cents,
      );
    };

    const nonTransferSums = await this.prisma.movement.groupBy({
      by: ['accountId', 'movementTypeId'],
      where: {
        accountId: { in: accountIds },
        ...(transferTypeId ? { movementTypeId: { not: transferTypeId } } : {}),
      },
      _sum: { amount: true },
    });
    for (const sum of nonTransferSums) {
      const cents = sum._sum.amount ? this.amountToCents(sum._sum.amount) : 0;
      const sign =
        typeNameById.get(sum.movementTypeId) === EXPENSE_TYPE_NAME ? -1 : 1;
      addToBalance(sum.accountId, sign * cents);
    }

    if (transferTypeId) {
      const [transfersOut, transfersIn] = await Promise.all([
        this.prisma.movement.groupBy({
          by: ['accountId'],
          where: {
            movementTypeId: transferTypeId,
            accountId: { in: accountIds },
          },
          _sum: { amount: true },
        }),
        this.prisma.movement.groupBy({
          by: ['toAccountId'],
          where: {
            movementTypeId: transferTypeId,
            toAccountId: { in: accountIds },
          },
          _sum: { amount: true },
        }),
      ]);
      for (const sum of transfersOut) {
        const cents = sum._sum.amount ? this.amountToCents(sum._sum.amount) : 0;
        addToBalance(sum.accountId, -cents);
      }
      for (const sum of transfersIn) {
        const cents = sum._sum.amount ? this.amountToCents(sum._sum.amount) : 0;
        addToBalance(sum.toAccountId!, cents);
      }
    }

    return accounts.map((record) => ({
      account: this.toEntity(record),
      balanceCents: balanceByAccountId.get(record.id) ?? 0,
    }));
  }

  private async loadTransferContext(): Promise<{
    typeNameById: Map<string, string>;
    transferTypeId?: string;
  }> {
    const movementTypes = await this.prisma.movementType.findMany();
    const typeNameById = new Map(
      movementTypes.map((type) => [type.id, type.name]),
    );
    const transferTypeId = movementTypes.find(
      (type) => type.name === TRANSFER_TYPE_NAME,
    )?.id;

    return { typeNameById, transferTypeId };
  }

  private amountToCents(amount: Decimal): number {
    return Number(amount.toFixed(2).replace('.', ''));
  }

  private toEntity(record: AccountModel): AccountEntity {
    return new AccountEntity(record);
  }
}
