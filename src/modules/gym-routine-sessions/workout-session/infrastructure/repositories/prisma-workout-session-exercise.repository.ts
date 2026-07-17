import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { WorkoutSessionExerciseEntity } from '../../domain/entities/workout-session-exercise.entity';
import type {
  LoggedExerciseEntry,
  PersonalRecordEntry,
  WorkoutSessionExerciseRepositoryPort,
} from '../../domain/ports/workout-session-exercise.repository.port';
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

  async findLoggedEntriesForExercise(
    exerciseId: string,
    userId: string,
  ): Promise<LoggedExerciseEntry[]> {
    // Single joined query — routine name comes free from the existing
    // WorkoutSession.routine relation, no separate lookup (design.md ADR-4).
    const rows = await this.prisma.workoutSessionExercise.findMany({
      where: { exerciseId, workoutSession: { userId } },
      include: {
        workoutSession: {
          select: {
            id: true,
            date: true,
            routine: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { workoutSession: { date: 'asc' } },
    });

    return rows.map((row) => ({
      sessionId: row.workoutSession.id,
      sessionDate: row.workoutSession.date,
      routineId: row.workoutSession.routine.id,
      routineName: row.workoutSession.routine.name,
      actualSets: row.actualSets,
      actualReps: row.actualReps,
      actualWeightGrams: row.actualWeightGrams,
    }));
  }

  async findPersonalRecords(userId: string): Promise<PersonalRecordEntry[]> {
    // Q1 — distinct-exercise-bounded, not row-bounded (design.md ADR-2).
    const grouped = await this.prisma.workoutSessionExercise.groupBy({
      by: ['exerciseId'],
      where: { workoutSession: { userId } },
      _max: { actualWeightGrams: true },
    });
    const pairs = grouped
      .filter((g) => g._max.actualWeightGrams !== null)
      .map((g) => ({
        exerciseId: g.exerciseId,
        actualWeightGrams: g._max.actualWeightGrams!,
      }));
    if (pairs.length === 0) return [];

    // Q2 — winning candidate rows; userId re-scoped (a (exerciseId,weight)
    // pair could otherwise match another user's row), date asc for the
    // tie-break the use case reduces on.
    const rows = await this.prisma.workoutSessionExercise.findMany({
      where: { workoutSession: { userId }, OR: pairs },
      include: {
        exercise: { select: { name: true } },
        workoutSession: {
          select: {
            id: true,
            date: true,
            routine: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { workoutSession: { date: 'asc' } },
    });

    return rows.map((row) => ({
      exerciseId: row.exerciseId,
      exerciseName: row.exercise.name,
      maxWeightGrams: row.actualWeightGrams,
      sessionId: row.workoutSession.id,
      sessionDate: row.workoutSession.date,
      routineId: row.workoutSession.routine.id,
      routineName: row.workoutSession.routine.name,
    }));
  }

  private toEntity(
    record: WorkoutSessionExerciseModel,
  ): WorkoutSessionExerciseEntity {
    return new WorkoutSessionExerciseEntity(record);
  }
}
