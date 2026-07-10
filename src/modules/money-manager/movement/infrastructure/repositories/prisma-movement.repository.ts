import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { MovementEntity } from '../../domain/entities/movement.entity';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';
import { MovementModel } from '@config/database/generated/prisma/models.js';
import type { Prisma } from '@config/database/generated/prisma/client.js';

// Decimal is a LOCAL alias, imported ONLY here in infra — the domain layer
// never sees Prisma's Decimal, only the integer cents this repository maps to.
type Decimal = Prisma.Decimal;

@Injectable()
export class PrismaMovementRepository implements MovementRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<MovementEntity[]> {
    const records = await this.prisma.movement.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
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
      },
    });

    return this.toEntity(record);
  }

  async delete(entity: MovementEntity): Promise<void> {
    await this.prisma.movement.delete({ where: { id: entity.id! } });
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
      userId: record.userId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
