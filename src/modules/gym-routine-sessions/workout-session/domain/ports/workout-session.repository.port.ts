import { WorkoutSessionEntity } from '../entities/workout-session.entity';
import { WorkoutSessionExerciseEntity } from '../entities/workout-session-exercise.entity';

export type WorkoutSessionWithExercises = {
  session: WorkoutSessionEntity;
  exercises: WorkoutSessionExerciseEntity[];
};

export interface WorkoutSessionRepositoryPort {
  findAll(userId: string): Promise<WorkoutSessionEntity[]>;
  findById(id: string, userId: string): Promise<WorkoutSessionEntity | null>;
  findByIdWithExercises(
    id: string,
    userId: string,
  ): Promise<WorkoutSessionWithExercises | null>;
  save(entity: WorkoutSessionEntity): Promise<WorkoutSessionEntity>;
  update(entity: WorkoutSessionEntity): Promise<WorkoutSessionEntity>;
  delete(entity: WorkoutSessionEntity): Promise<void>;
}

export const WORKOUT_SESSION_REPOSITORY = Symbol(
  'WorkoutSessionRepositoryPort',
);
