import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { ExerciseEntity } from '../../domain/entities/exercise.entity';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';
import { ExerciseModel } from '@config/database/generated/prisma/models.js';

@Injectable()
export class PrismaExerciseRepository implements ExerciseRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<ExerciseEntity[]> {
    const isPaginated = page !== undefined || limit !== undefined;
    const records = await this.prisma.exercise.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: { name: 'asc' },
      ...(isPaginated
        ? {
            skip: ((page ?? 1) - 1) * (limit ?? 20),
            take: limit ?? 20,
          }
        : {}),
    });
    return records.map((r) => this.toEntity(r));
  }

  async findByIds(ids: string[], userId: string): Promise<ExerciseEntity[]> {
    if (ids.length === 0) return [];
    const records = await this.prisma.exercise.findMany({
      where: { id: { in: ids }, OR: [{ userId }, { userId: null }] },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string, userId: string): Promise<ExerciseEntity | null> {
    const record = await this.prisma.exercise.findFirst({
      where: { id, OR: [{ userId }, { userId: null }] },
    });
    return record ? this.toEntity(record) : null;
  }

  async findOwnById(
    id: string,
    userId: string,
  ): Promise<ExerciseEntity | null> {
    const record = await this.prisma.exercise.findFirst({
      where: { id, userId },
    });
    return record ? this.toEntity(record) : null;
  }

  async save(entity: ExerciseEntity): Promise<ExerciseEntity> {
    const record = await this.prisma.exercise.create({
      data: {
        id: entity.id,
        userId: entity.userId,
        name: entity.name,
        nameEs: entity.nameEs ?? undefined,
        category: entity.category,
        bodyPart: entity.bodyPart,
        equipment: entity.equipment,
        target: entity.target,
        muscleGroup: entity.muscleGroup,
        secondaryMuscles: entity.secondaryMuscles ?? [],
        instructions: entity.instructions ?? undefined,
        image: entity.image,
        gifUrl: entity.gifUrl,
        attribution: entity.attribution,
      },
    });

    return this.toEntity(record);
  }

  async update(entity: ExerciseEntity): Promise<ExerciseEntity> {
    const record = await this.prisma.exercise.update({
      where: { id: entity.id! },
      data: {
        name: entity.name,
        category: entity.category,
        bodyPart: entity.bodyPart,
        equipment: entity.equipment,
        target: entity.target,
        muscleGroup: entity.muscleGroup,
      },
    });

    return this.toEntity(record);
  }

  async delete(entity: ExerciseEntity): Promise<void> {
    await this.prisma.exercise.delete({ where: { id: entity.id! } });
  }

  async countRoutineExercisesByExerciseId(exerciseId: string): Promise<number> {
    return this.prisma.routineExercise.count({ where: { exerciseId } });
  }

  async countSessionExercisesByExerciseId(exerciseId: string): Promise<number> {
    return this.prisma.workoutSessionExercise.count({ where: { exerciseId } });
  }

  async countByUserId(userId: string): Promise<number> {
    return this.prisma.exercise.count({
      where: { OR: [{ userId }, { userId: null }] },
    });
  }

  private toEntity(record: ExerciseModel): ExerciseEntity {
    return new ExerciseEntity({
      ...record,
      // Json? maps to Prisma.JsonValue at the client boundary — this field
      // is read-mostly with no domain logic operating on its internal
      // shape, so a straightforward assertion here is enough (no existing
      // precedent for a typed Json column elsewhere in this codebase).
      instructions: record.instructions as Record<string, string> | null,
    });
  }
}
