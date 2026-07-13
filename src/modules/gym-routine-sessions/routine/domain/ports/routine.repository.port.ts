import { RoutineEntity } from '../entities/routine.entity';
import { RoutineExerciseEntity } from '../entities/routine-exercise.entity';

export type RoutineWithExerciseCount = {
  routine: RoutineEntity;
  exerciseCount: number;
};

export type RoutineWithExercises = {
  routine: RoutineEntity;
  exercises: RoutineExerciseEntity[];
};

export type RoutineExerciseInput = {
  exerciseId: string;
  order: number;
  targetSets: number;
  targetReps: number;
  targetWeightGrams: number;
};

export interface RoutineRepositoryPort {
  findAll(userId: string): Promise<RoutineWithExerciseCount[]>;
  findById(id: string, userId: string): Promise<RoutineEntity | null>;
  findByIdWithExercises(
    id: string,
    userId: string,
  ): Promise<RoutineWithExercises | null>;
  findByName(name: string, userId: string): Promise<RoutineEntity | null>;
  save(
    entity: RoutineEntity,
    exercises: RoutineExerciseInput[],
  ): Promise<RoutineEntity>;
  update(
    entity: RoutineEntity,
    exercises?: RoutineExerciseInput[],
  ): Promise<RoutineEntity>;
  delete(entity: RoutineEntity): Promise<void>;
  countSessionsByRoutineId(routineId: string): Promise<number>;
}

export const ROUTINE_REPOSITORY = Symbol('RoutineRepositoryPort');
