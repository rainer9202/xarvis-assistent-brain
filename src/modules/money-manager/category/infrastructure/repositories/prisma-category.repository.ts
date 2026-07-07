import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { CategoryEntity } from '../../domain/entities/category.entity';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import { CategoryModel } from '@config/database/generated/prisma/models.js';

@Injectable()
export class PrismaCategoryRepository implements CategoryRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<CategoryEntity[]> {
    const records = await this.prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string, userId: string): Promise<CategoryEntity | null> {
    const record = await this.prisma.category.findFirst({
      where: { id, userId },
    });
    return record ? this.toEntity(record) : null;
  }

  async findByNameAndMovementTypeId(
    name: string,
    movementTypeId: string,
    userId: string,
  ): Promise<CategoryEntity | null> {
    const record = await this.prisma.category.findUnique({
      where: { name_movementTypeId_userId: { name, movementTypeId, userId } },
    });
    return record ? this.toEntity(record) : null;
  }

  async save(entity: CategoryEntity): Promise<CategoryEntity> {
    const record = await this.prisma.category.create({
      data: {
        id: entity.id,
        name: entity.name,
        movementTypeId: entity.movementTypeId,
        userId: entity.userId,
        isActive: entity.isActive,
      },
    });

    return this.toEntity(record);
  }

  async update(entity: CategoryEntity): Promise<CategoryEntity> {
    const record = await this.prisma.category.update({
      where: { id: entity.id! },
      data: {
        name: entity.name,
        movementTypeId: entity.movementTypeId,
        isActive: entity.isActive,
      },
    });

    return this.toEntity(record);
  }

  async delete(entity: CategoryEntity): Promise<void> {
    await this.prisma.category.delete({ where: { id: entity.id! } });
  }

  async countMovementsByCategoryId(categoryId: string): Promise<number> {
    return this.prisma.movement.count({ where: { categoryId } });
  }

  private toEntity(record: CategoryModel): CategoryEntity {
    return new CategoryEntity(record);
  }
}
