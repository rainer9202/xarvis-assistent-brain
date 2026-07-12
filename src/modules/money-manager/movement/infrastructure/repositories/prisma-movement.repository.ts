import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { MovementEntity } from '../../domain/entities/movement.entity';
import type {
  MovementFilters,
  MovementRepositoryPort,
} from '../../domain/ports/movement.repository.port';
import { MovementModel } from '@config/database/generated/prisma/models.js';
import type { Prisma } from '@config/database/generated/prisma/client.js';

// Decimal is a LOCAL alias, imported ONLY here in infra — the domain layer
// never sees Prisma's Decimal, only the integer cents this repository maps to.
type Decimal = Prisma.Decimal;

@Injectable()
export class PrismaMovementRepository implements MovementRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    filters?: MovementFilters,
  ): Promise<MovementEntity[]> {
    const isPaginated =
      filters?.page !== undefined || filters?.limit !== undefined;
    const records = await this.prisma.movement.findMany({
      where: this.buildWhereClause(userId, filters),
      orderBy: { date: 'desc' },
      ...(isPaginated
        ? {
            skip: ((filters?.page ?? 1) - 1) * (filters?.limit ?? 20),
            take: filters?.limit ?? 20,
          }
        : {}),
    });
    return records.map((r) => this.toEntity(r));
  }

  async count(userId: string, filters?: MovementFilters): Promise<number> {
    return this.prisma.movement.count({
      where: this.buildWhereClause(userId, filters),
    });
  }

  private buildWhereClause(
    userId: string,
    filters?: MovementFilters,
  ): Prisma.MovementWhereInput {
    const monthRange = filters?.month
      ? this.monthToDateRange(filters.month)
      : undefined;
    const dateRange =
      !monthRange && (filters?.dateFrom || filters?.dateTo)
        ? this.dateRangeFilter(filters?.dateFrom, filters?.dateTo)
        : undefined;
    // An explicit month always wins. Otherwise an explicit date range
    // (dateFrom/dateTo) wins over the default window. Otherwise, unless the
    // caller opted into historic=true, default to only the last 3 calendar
    // months — open-ended (no upper bound) so it still includes
    // today/future-dated movements.
    const defaultWindowStart =
      !monthRange && !dateRange && !filters?.historic
        ? this.lastThreeMonthsStart()
        : undefined;

    return {
      userId,
      // Matches both directions so a transfer INTO this account shows up
      // in its history too, not just movements originating from it —
      // mirrors the same OR pattern countMovementsByAccountId() uses.
      ...(filters?.accountId
        ? {
            OR: [
              { accountId: filters.accountId },
              { toAccountId: filters.accountId },
            ],
          }
        : {}),
      ...(filters?.categoryId?.length
        ? { categoryId: { in: filters.categoryId } }
        : {}),
      ...(filters?.movementType ? { movementType: filters.movementType } : {}),
      ...(filters?.groupId ? { groupId: filters.groupId } : {}),
      ...(monthRange
        ? { date: { gte: monthRange.start, lt: monthRange.end } }
        : {}),
      ...(dateRange ? { date: dateRange } : {}),
      ...(defaultWindowStart ? { date: { gte: defaultWindowStart } } : {}),
    };
  }

  async findById(id: string, userId: string): Promise<MovementEntity | null> {
    const record = await this.prisma.movement.findFirst({
      where: { id, userId },
    });
    return record ? this.toEntity(record) : null;
  }

  async save(entity: MovementEntity): Promise<MovementEntity> {
    const record = await this.prisma.movement.create({
      data: {
        id: entity.id,
        amount: this.centsToDecimalInput(entity.amountCents),
        date: entity.date,
        note: entity.note,
        accountId: entity.accountId,
        toAccountId: entity.toAccountId ?? null,
        categoryId: entity.categoryId,
        movementType: entity.movementType,
        groupId: entity.groupId ?? null,
        userId: entity.userId,
      },
    });

    return this.toEntity(record);
  }

  async update(entity: MovementEntity): Promise<MovementEntity> {
    const record = await this.prisma.movement.update({
      where: { id: entity.id! },
      data: {
        amount: this.centsToDecimalInput(entity.amountCents),
        date: entity.date,
        note: entity.note,
        accountId: entity.accountId,
        toAccountId: entity.toAccountId ?? null,
        categoryId: entity.categoryId,
        movementType: entity.movementType,
        groupId: entity.groupId ?? null,
      },
    });

    return this.toEntity(record);
  }

  async delete(entity: MovementEntity): Promise<void> {
    await this.prisma.movement.delete({ where: { id: entity.id! } });
  }

  // GetMovementsQueryDto already validates the YYYY-MM shape, so this only
  // ever runs on a well-formed string.
  private monthToDateRange(month: string): { start: Date; end: Date } {
    const [year, monthNumber] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthNumber - 1, 1));
    const end = new Date(Date.UTC(year, monthNumber, 1));
    return { start, end };
  }

  // Builds a Prisma date-range filter from ISO8601 strings, inclusive on
  // both ends. Either bound may be omitted independently.
  private dateRangeFilter(
    dateFrom?: string,
    dateTo?: string,
  ): { gte?: Date; lte?: Date } {
    return {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }

  // Start of the calendar month 2 months before the current one, UTC — e.g.
  // if "now" is anywhere in 2026-07, this returns 2026-05-01T00:00:00.000Z,
  // giving a rolling 3-calendar-month window (May, June, July).
  private lastThreeMonthsStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  }

  private centsToDecimalInput(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  private decimalToCents(amount: Decimal): number {
    return Number(amount.toFixed(2).replace('.', ''));
  }

  private toEntity(record: MovementModel): MovementEntity {
    return new MovementEntity({
      id: record.id,
      amountCents: this.decimalToCents(record.amount),
      date: record.date,
      note: record.note ?? undefined,
      accountId: record.accountId,
      toAccountId: record.toAccountId ?? undefined,
      categoryId: record.categoryId,
      movementType: record.movementType,
      groupId: record.groupId ?? undefined,
      userId: record.userId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
