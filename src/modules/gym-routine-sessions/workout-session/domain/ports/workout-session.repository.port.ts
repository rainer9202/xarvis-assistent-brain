import { WorkoutSessionEntity } from '../entities/workout-session.entity';
import { WorkoutSessionExerciseEntity } from '../entities/workout-session-exercise.entity';

export type WorkoutSessionWithExercises = {
  session: WorkoutSessionEntity;
  exercises: WorkoutSessionExerciseEntity[];
};

export type WorkoutSessionWithLoggedCount = {
  session: WorkoutSessionEntity;
  loggedExerciseCount: number;
};

export interface WorkoutSessionRepositoryPort {
  findAll(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<WorkoutSessionWithLoggedCount[]>;
  findById(id: string, userId: string): Promise<WorkoutSessionEntity | null>;
  findByIdWithExercises(
    id: string,
    userId: string,
  ): Promise<WorkoutSessionWithExercises | null>;
  save(entity: WorkoutSessionEntity): Promise<WorkoutSessionEntity>;
  update(entity: WorkoutSessionEntity): Promise<WorkoutSessionEntity>;
  delete(entity: WorkoutSessionEntity): Promise<void>;
  countByUserId(userId: string): Promise<number>;
}

export const WORKOUT_SESSION_REPOSITORY = Symbol(
  'WorkoutSessionRepositoryPort',
);
