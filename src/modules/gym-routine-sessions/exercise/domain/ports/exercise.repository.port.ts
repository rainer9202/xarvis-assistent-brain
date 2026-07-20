import { ExerciseEntity } from '../entities/exercise.entity';

export interface ExerciseRepositoryPort {
  findAll(
    userId: string,
    page?: number,
    limit?: number,
    search?: string,
    isCustom?: boolean,
  ): Promise<ExerciseEntity[]>;
  findByIds(ids: string[], userId: string): Promise<ExerciseEntity[]>;
  findById(id: string, userId: string): Promise<ExerciseEntity | null>;
  findOwnById(id: string, userId: string): Promise<ExerciseEntity | null>;
  save(entity: ExerciseEntity): Promise<ExerciseEntity>;
  update(entity: ExerciseEntity): Promise<ExerciseEntity>;
  delete(entity: ExerciseEntity): Promise<void>;
  countRoutineExercisesByExerciseId(exerciseId: string): Promise<number>;
  countSessionExercisesByExerciseId(exerciseId: string): Promise<number>;
  countByUserId(
    userId: string,
    search?: string,
    isCustom?: boolean,
  ): Promise<number>;
}

export const EXERCISE_REPOSITORY = Symbol('ExerciseRepositoryPort');
