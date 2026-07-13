import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { WorkoutSessionEntity } from '../../domain/entities/workout-session.entity';
import { WorkoutSessionExerciseEntity } from '../../domain/entities/workout-session-exercise.entity';
import type {
  WorkoutSessionRepositoryPort,
  WorkoutSessionWithExercises,
} from '../../domain/ports/workout-session.repository.port';
import {
  WorkoutSessionModel,
  WorkoutSessionExerciseModel,
} from '@config/database/generated/prisma/models.js';

@Injectable()
export class PrismaWorkoutSessionRepository implements WorkoutSessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<WorkoutSessionEntity[]> {
    const records = await this.prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(
    id: string,
    userId: string,
  ): Promise<WorkoutSessionEntity | null> {
    const record = await this.prisma.workoutSession.findFirst({
      where: { id, userId },
    });
    return record ? this.toEntity(record) : null;
  }

  async findByIdWithExercises(
    id: string,
    userId: string,
  ): Promise<WorkoutSessionWithExercises | null> {
    const record = await this.prisma.workoutSession.findFirst({
      where: { id, userId },
      include: { exercises: true },
    });
    if (!record) return null;

    return {
      session: this.toEntity(record),
      exercises: record.exercises.map((e) => this.toExerciseEntity(e)),
    };
  }

  async save(entity: WorkoutSessionEntity): Promise<WorkoutSessionEntity> {
    const record = await this.prisma.workoutSession.create({
      data: {
        id: entity.id,
        userId: entity.userId,
        routineId: entity.routineId,
        date: entity.date,
        finishedAt: entity.finishedAt,
      },
    });

    return this.toEntity(record);
  }

  async update(entity: WorkoutSessionEntity): Promise<WorkoutSessionEntity> {
    const record = await this.prisma.workoutSession.update({
      where: { id: entity.id! },
      data: {
        finishedAt: entity.finishedAt,
      },
    });

    return this.toEntity(record);
  }

  async delete(entity: WorkoutSessionEntity): Promise<void> {
    await this.prisma.workoutSession.delete({ where: { id: entity.id! } });
  }

  private toEntity(record: WorkoutSessionModel): WorkoutSessionEntity {
    return new WorkoutSessionEntity(record);
  }

  private toExerciseEntity(
    record: WorkoutSessionExerciseModel,
  ): WorkoutSessionExerciseEntity {
    return new WorkoutSessionExerciseEntity(record);
  }
}
