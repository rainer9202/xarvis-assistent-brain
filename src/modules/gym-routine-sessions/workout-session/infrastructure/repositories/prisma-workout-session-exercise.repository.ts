import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { WorkoutSessionExerciseEntity } from '../../domain/entities/workout-session-exercise.entity';
import type { WorkoutSessionExerciseRepositoryPort } from '../../domain/ports/workout-session-exercise.repository.port';
import { WorkoutSessionExerciseModel } from '@config/database/generated/prisma/models.js';

@Injectable()
export class PrismaWorkoutSessionExerciseRepository implements WorkoutSessionExerciseRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<WorkoutSessionExerciseEntity | null> {
    const record = await this.prisma.workoutSessionExercise.findUnique({
      where: { id },
    });
    return record ? this.toEntity(record) : null;
  }

  async save(
    entity: WorkoutSessionExerciseEntity,
  ): Promise<WorkoutSessionExerciseEntity> {
    const record = await this.prisma.workoutSessionExercise.create({
      data: {
        id: entity.id,
        workoutSessionId: entity.workoutSessionId,
        exerciseId: entity.exerciseId,
        actualSets: entity.actualSets,
        actualReps: entity.actualReps,
        actualWeightGrams: entity.actualWeightGrams,
      },
    });

    return this.toEntity(record);
  }

  async update(
    entity: WorkoutSessionExerciseEntity,
  ): Promise<WorkoutSessionExerciseEntity> {
    const record = await this.prisma.workoutSessionExercise.update({
      where: { id: entity.id! },
      data: {
        actualSets: entity.actualSets,
        actualReps: entity.actualReps,
        actualWeightGrams: entity.actualWeightGrams,
      },
    });

    return this.toEntity(record);
  }

  async delete(entity: WorkoutSessionExerciseEntity): Promise<void> {
    await this.prisma.workoutSessionExercise.delete({
      where: { id: entity.id! },
    });
  }

  private toEntity(
    record: WorkoutSessionExerciseModel,
  ): WorkoutSessionExerciseEntity {
    return new WorkoutSessionExerciseEntity(record);
  }
}
