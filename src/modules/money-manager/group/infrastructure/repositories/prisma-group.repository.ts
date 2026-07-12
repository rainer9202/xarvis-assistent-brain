import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { GroupEntity } from '../../domain/entities/group.entity';
import type { GroupRepositoryPort } from '../../domain/ports/group.repository.port';
import { GroupModel } from '@config/database/generated/prisma/models.js';
import type { Prisma } from '@config/database/generated/prisma/client.js';

// Decimal is a LOCAL alias, imported ONLY here in infra — the domain layer
// never sees Prisma's Decimal, only the integer cents this repository maps to.
type Decimal = Prisma.Decimal;

@Injectable()
export class PrismaGroupRepository implements GroupRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<GroupEntity[]> {
    const records = await this.prisma.group.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string, userId: string): Promise<GroupEntity | null> {
    const record = await this.prisma.group.findFirst({
      where: { id, userId },
    });
    return record ? this.toEntity(record) : null;
  }

  async findByName(name: string, userId: string): Promise<GroupEntity | null> {
    const record = await this.prisma.group.findUnique({
      where: { name_userId: { name, userId } },
    });
    return record ? this.toEntity(record) : null;
  }

  async save(entity: GroupEntity): Promise<GroupEntity> {
    const record = await this.prisma.group.create({
      data: {
        id: entity.id,
        name: entity.name,
        userId: entity.userId,
        isActive: entity.isActive,
        budgetCents:
          entity.budgetCents != null
            ? this.centsToDecimalInput(entity.budgetCents)
            : null,
      },
    });

    return this.toEntity(record);
  }

  async update(entity: GroupEntity): Promise<GroupEntity> {
    const record = await this.prisma.group.update({
      where: { id: entity.id! },
      data: {
        name: entity.name,
        isActive: entity.isActive,
        budgetCents:
          entity.budgetCents != null
            ? this.centsToDecimalInput(entity.budgetCents)
            : null,
      },
    });

    return this.toEntity(record);
  }

  async delete(entity: GroupEntity): Promise<void> {
    await this.prisma.group.delete({ where: { id: entity.id! } });
  }

  private centsToDecimalInput(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  private decimalToCents(amount: Decimal): number {
    return Number(amount.toFixed(2).replace('.', ''));
  }

  private toEntity(record: GroupModel): GroupEntity {
    return new GroupEntity({
      ...record,
      budgetCents:
        record.budgetCents != null
          ? this.decimalToCents(record.budgetCents)
          : null,
    });
  }
}
