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

// The only MovementType name that flips balance sign; everything else
// (income, transfer) adds. Transfer semantics are deferred (open design
// question) — treated as a neutral addition until a dedicated decision lands.
const EXPENSE_TYPE_NAME = 'expense';

@Injectable()
export class PrismaAccountRepository implements AccountRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<AccountEntity[]> {
    const records = await this.prisma.account.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string): Promise<AccountEntity | null> {
    const record = await this.prisma.account.findUnique({ where: { id } });
    return record ? this.toEntity(record) : null;
  }

  async save(entity: AccountEntity): Promise<AccountEntity> {
    const record = await this.prisma.account.create({
      data: {
        id: entity.id,
        name: entity.name,
        type: entity.type,
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

  async countMovementsByAccountId(accountId: string): Promise<number> {
    return this.prisma.movement.count({ where: { accountId } });
  }

  async findAllWithBalance(): Promise<AccountBalance[]> {
    const [accounts, sums, movementTypes] = await Promise.all([
      this.prisma.account.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.movement.groupBy({
        by: ['accountId', 'movementTypeId'],
        _sum: { amount: true },
      }),
      this.prisma.movementType.findMany(),
    ]);

    const typeNameById = new Map(
      movementTypes.map((type) => [type.id, type.name]),
    );

    const balanceByAccountId = new Map<string, number>();
    for (const sum of sums) {
      const cents = sum._sum.amount ? this.amountToCents(sum._sum.amount) : 0;
      const sign =
        typeNameById.get(sum.movementTypeId) === EXPENSE_TYPE_NAME ? -1 : 1;
      const current = balanceByAccountId.get(sum.accountId) ?? 0;
      balanceByAccountId.set(sum.accountId, current + sign * cents);
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
