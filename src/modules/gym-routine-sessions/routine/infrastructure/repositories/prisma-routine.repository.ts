import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { ConflictException } from '@domain/exceptions/domain.exception';
import { RoutineEntity } from '../../domain/entities/routine.entity';
import { RoutineExerciseEntity } from '../../domain/entities/routine-exercise.entity';
import type {
  RoutineExerciseInput,
  RoutineRepositoryPort,
  RoutineWithExerciseCount,
  RoutineWithExercises,
} from '../../domain/ports/routine.repository.port';
import {
  RoutineModel,
  RoutineExerciseModel,
} from '@config/database/generated/prisma/models.js';

@Injectable()
export class PrismaRoutineRepository implements RoutineRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<RoutineWithExerciseCount[]> {
    const isPaginated = page !== undefined || limit !== undefined;
    const records = await this.prisma.routine.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { exercises: true } } },
      ...(isPaginated
        ? {
            skip: ((page ?? 1) - 1) * (limit ?? 20),
            take: limit ?? 20,
          }
        : {}),
    });
    return records.map((record) => ({
      routine: this.toEntity(record),
      exerciseCount: record._count.exercises,
    }));
  }

  async findById(id: string, userId: string): Promise<RoutineEntity | null> {
    const record = await this.prisma.routine.findFirst({
      where: { id, userId },
    });
    return record ? this.toEntity(record) : null;
  }

  async findByIdWithExercises(
    id: string,
    userId: string,
  ): Promise<RoutineWithExercises | null> {
    const record = await this.prisma.routine.findFirst({
      where: { id, userId },
      include: { exercises: { orderBy: { order: 'asc' } } },
    });
    if (!record) return null;

    return {
      routine: this.toEntity(record),
      exercises: record.exercises.map((e) => this.toExerciseEntity(e)),
    };
  }

  async findByName(
    name: string,
    userId: string,
  ): Promise<RoutineEntity | null> {
    const record = await this.prisma.routine.findUnique({
      where: { name_userId: { name, userId } },
    });
    return record ? this.toEntity(record) : null;
  }

  async save(
    entity: RoutineEntity,
    exercises: RoutineExerciseInput[],
  ): Promise<RoutineEntity> {
    // Interactive transaction (not the array form used by
    // PrismaAccountRepository.setPrincipal) because the RoutineExercise rows
    // need the newly-created routine's id, which array-form $transaction
    // batched queries can't reference from one another.
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const routine = await tx.routine.create({
          data: {
            id: entity.id,
            name: entity.name,
            userId: entity.userId,
            isActive: entity.isActive,
          },
        });

        if (exercises.length > 0) {
          await tx.routineExercise.createMany({
            data: exercises.map((exercise) => ({
              routineId: routine.id,
              exerciseId: exercise.exerciseId,
              order: exercise.order,
              targetSets: exercise.targetSets,
              targetReps: exercise.targetReps,
              targetWeightGrams: exercise.targetWeightGrams,
            })),
          });
        }

        return routine;
      });

      return this.toEntity(record);
    } catch (error) {
      // Closes the same TOCTOU race CreateRoutineUseCase's findByName
      // pre-check can't fully close on its own: two concurrent creates for
      // the same (name, userId) can both pass that check, so the losing
      // tx.routine.create() here hits the @@unique([name, userId]) DB
      // constraint (P2002) instead of returning a clean 409 — same
      // duck-typed pattern as PrismaUserRepository.create().
      if (this.isUniqueConstraintViolation(error))
        throw new ConflictException(`Routine "${entity.name}" already exists`);
      throw error;
    }
  }

  async update(
    entity: RoutineEntity,
    exercises?: RoutineExerciseInput[],
  ): Promise<RoutineEntity> {
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const routine = await tx.routine.update({
          where: { id: entity.id! },
          data: {
            name: entity.name,
            isActive: entity.isActive,
          },
        });

        // undefined => leave the existing exercise list untouched;
        // array (including []) => full-replace semantics, not a diff.
        if (exercises !== undefined) {
          await tx.routineExercise.deleteMany({
            where: { routineId: entity.id! },
          });
          if (exercises.length > 0) {
            await tx.routineExercise.createMany({
              data: exercises.map((exercise) => ({
                routineId: entity.id!,
                exerciseId: exercise.exerciseId,
                order: exercise.order,
                targetSets: exercise.targetSets,
                targetReps: exercise.targetReps,
                targetWeightGrams: exercise.targetWeightGrams,
              })),
            });
          }
        }

        return routine;
      });

      return this.toEntity(record);
    } catch (error) {
      // Same TOCTOU race as save() above, on the rename path: two concurrent
      // updates renaming different routines to the same new name can both
      // pass UpdateRoutineUseCase's findByName pre-check.
      if (this.isUniqueConstraintViolation(error))
        throw new ConflictException(`Routine "${entity.name}" already exists`);
      throw error;
    }
  }

  async delete(entity: RoutineEntity): Promise<void> {
    await this.prisma.routine.delete({ where: { id: entity.id! } });
  }

  async countSessionsByRoutineId(routineId: string): Promise<number> {
    return this.prisma.workoutSession.count({ where: { routineId } });
  }

  async countByUserId(userId: string): Promise<number> {
    return this.prisma.routine.count({ where: { userId } });
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private toEntity(record: RoutineModel): RoutineEntity {
    return new RoutineEntity(record);
  }

  private toExerciseEntity(
    record: RoutineExerciseModel,
  ): RoutineExerciseEntity {
    return new RoutineExerciseEntity(record);
  }
}
