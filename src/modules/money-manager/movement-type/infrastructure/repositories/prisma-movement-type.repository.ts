import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { MovementTypeEntity } from '../../domain/entities/movement-type.entity';
import type { MovementTypeRepositoryPort } from '../../domain/ports/movement-type.repository.port';
import { MovementTypeModel } from '@config/database/generated/prisma/models.js';

@Injectable()
export class PrismaMovementTypeRepository implements MovementTypeRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<MovementTypeEntity[]> {
    const records = await this.prisma.movementType.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string): Promise<MovementTypeEntity | null> {
    const record = await this.prisma.movementType.findUnique({ where: { id } });
    return record ? this.toEntity(record) : null;
  }

  async findByName(name: string): Promise<MovementTypeEntity | null> {
    const record = await this.prisma.movementType.findUnique({
      where: { name },
    });
    return record ? this.toEntity(record) : null;
  }

  async save(entity: MovementTypeEntity): Promise<MovementTypeEntity> {
    const record = await this.prisma.movementType.create({
      data: { id: entity.id, name: entity.name },
    });

    return this.toEntity(record);
  }

  async delete(entity: MovementTypeEntity): Promise<void> {
    await this.prisma.movementType.delete({ where: { id: entity.id! } });
  }

  async countCategoriesByMovementTypeId(
    movementTypeId: string,
  ): Promise<number> {
    return this.prisma.category.count({ where: { movementTypeId } });
  }

  async countMovementsByMovementTypeId(
    movementTypeId: string,
  ): Promise<number> {
    return this.prisma.movement.count({ where: { movementTypeId } });
  }

  private toEntity(record: MovementTypeModel): MovementTypeEntity {
    return new MovementTypeEntity(record);
  }
}
