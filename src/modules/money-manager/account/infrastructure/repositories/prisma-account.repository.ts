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
const EXPENSE_TYPE_NAME = 'MT01';
const TRANSFER_TYPE_NAME = 'MT03';

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
    try {
      const record = await this.prisma.account.create({
        data: {
          id: entity.id,
          name: entity.name,
          type: entity.type,
          userId: entity.userId,
          isActive: entity.isActive,
          isPrincipal: entity.isPrincipal,
        },
      });

      return this.toEntity(record);
    } catch (error) {
      // Closes a TOCTOU race in CreateAccountUseCase: two concurrent
      // first-account creations for the same brand-new user can both see
      // countByUserId() === 0 and both attempt isPrincipal: true. The
      // partial unique index (accounts_user_id_principal_unique, see
      // migration 20260710150000_account_principal_partial_unique_index)
      // lets only one such row commit; the loser retries as a normal
      // (non-principal) account instead of failing outright — same
      // duck-typed P2002 pattern PrismaUserRepository.create() uses for
      // the equivalent email-uniqueness race.
      if (entity.isPrincipal && this.isUniqueConstraintViolation(error)) {
        const record = await this.prisma.account.create({
          data: {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            userId: entity.userId,
            isActive: entity.isActive,
            isPrincipal: false,
          },
        });

        return this.toEntity(record);
      }
      throw error;
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  async update(entity: AccountEntity): Promise<AccountEntity> {
    const record = await this.prisma.account.update({
      where: { id: entity.id! },
      data: {
        name: entity.name,
        type: entity.type,
        isActive: entity.isActive,
        isPrincipal: entity.isPrincipal,
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

  async countByUserId(userId: string): Promise<number> {
    return this.prisma.account.count({ where: { userId } });
  }

  async setPrincipal(id: string, userId: string): Promise<void> {
    // Must run as a single DB transaction: two concurrent "make X principal"
    // requests for different accounts of the same user must not both commit
    // and leave two principal accounts (or zero, if interleaved wrong).
    // Wrapping the unset-old + set-new pair in one $transaction makes
    // Postgres serialize them so the invariant (exactly one principal per
    // user) always holds, the same way PrismaUserRepository.create() leans
    // on a DB-level mechanism (the unique constraint) instead of an
    // application-level check-then-act.
    await this.prisma.$transaction([
      this.prisma.account.updateMany({
        where: { userId, isPrincipal: true, id: { not: id } },
        data: { isPrincipal: false },
      }),
      this.prisma.account.update({
        where: { id },
        data: { isPrincipal: true },
      }),
    ]);
  }

  async findByIdWithBalance(
    id: string,
    userId: string,
  ): Promise<AccountBalance | null> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!account) return null;

    let balanceCents = 0;

    const nonTransferSums = await this.prisma.movement.groupBy({
      by: ['movementType'],
      where: {
        accountId: id,
        movementType: { not: TRANSFER_TYPE_NAME },
      },
      _sum: { amount: true },
    });
    for (const sum of nonTransferSums) {
      const cents = sum._sum.amount ? this.amountToCents(sum._sum.amount) : 0;
      const sign = sum.movementType === EXPENSE_TYPE_NAME ? -1 : 1;
      balanceCents += sign * cents;
    }

    const [transfersOut, transfersIn] = await Promise.all([
      this.prisma.movement.aggregate({
        where: { accountId: id, movementType: TRANSFER_TYPE_NAME },
        _sum: { amount: true },
      }),
      this.prisma.movement.aggregate({
        where: { toAccountId: id, movementType: TRANSFER_TYPE_NAME },
        _sum: { amount: true },
      }),
    ]);
    if (transfersOut._sum.amount)
      balanceCents -= this.amountToCents(transfersOut._sum.amount);
    if (transfersIn._sum.amount)
      balanceCents += this.amountToCents(transfersIn._sum.amount);

    return { account: this.toEntity(account), balanceCents };
  }

  async findAllWithBalance(userId: string): Promise<AccountBalance[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    const accountIds = accounts.map((account) => account.id);

    const balanceByAccountId = new Map<string, number>();
    const addToBalance = (accountId: string, cents: number) => {
      balanceByAccountId.set(
        accountId,
        (balanceByAccountId.get(accountId) ?? 0) + cents,
      );
    };

    const nonTransferSums = await this.prisma.movement.groupBy({
      by: ['accountId', 'movementType'],
      where: {
        accountId: { in: accountIds },
        movementType: { not: TRANSFER_TYPE_NAME },
      },
      _sum: { amount: true },
    });
    for (const sum of nonTransferSums) {
      const cents = sum._sum.amount ? this.amountToCents(sum._sum.amount) : 0;
      const sign = sum.movementType === EXPENSE_TYPE_NAME ? -1 : 1;
      addToBalance(sum.accountId, sign * cents);
    }

    const [transfersOut, transfersIn] = await Promise.all([
      this.prisma.movement.groupBy({
        by: ['accountId'],
        where: {
          movementType: TRANSFER_TYPE_NAME,
          accountId: { in: accountIds },
        },
        _sum: { amount: true },
      }),
      this.prisma.movement.groupBy({
        by: ['toAccountId'],
        where: {
          movementType: TRANSFER_TYPE_NAME,
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

    return accounts.map((record) => ({
      account: this.toEntity(record),
      balanceCents: balanceByAccountId.get(record.id) ?? 0,
    }));
  }

  private amountToCents(amount: Decimal): number {
    return Number(amount.toFixed(2).replace('.', ''));
  }

  private toEntity(record: AccountModel): AccountEntity {
    return new AccountEntity(record);
  }
}
