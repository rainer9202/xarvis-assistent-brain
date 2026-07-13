jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { WorkoutSessionExerciseEntity } from '../../domain/entities/workout-session-exercise.entity';
import { PrismaWorkoutSessionExerciseRepository } from './prisma-workout-session-exercise.repository';
import type { PrismaService } from '@config/database/prisma.service';

describe('PrismaWorkoutSessionExerciseRepository', () => {
  let repository: PrismaWorkoutSessionExerciseRepository;
  let prisma: {
    workoutSessionExercise: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const record = {
    id: 'wse-1',
    workoutSessionId: 'session-1',
    exerciseId: 'ex-1',
    actualSets: 4,
    actualReps: 10,
    actualWeightGrams: 18000,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      workoutSessionExercise: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    repository = new PrismaWorkoutSessionExerciseRepository(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('queries by id only (no userId — ownership is checked one level up)', async () => {
      prisma.workoutSessionExercise.findUnique.mockResolvedValue(record);

      const result = await repository.findById('wse-1');

      expect(prisma.workoutSessionExercise.findUnique).toHaveBeenCalledWith({
        where: { id: 'wse-1' },
      });
      expect(result).toBeInstanceOf(WorkoutSessionExerciseEntity);
    });
  });

  describe('save', () => {
    it('creates a record from the entity', async () => {
      const entity = new WorkoutSessionExerciseEntity({
        workoutSessionId: 'session-1',
        exerciseId: 'ex-1',
        actualSets: 4,
        actualReps: 10,
        actualWeightGrams: 18000,
      });
      prisma.workoutSessionExercise.create.mockResolvedValue(record);

      const result = await repository.save(entity);

      expect(prisma.workoutSessionExercise.create).toHaveBeenCalledWith({
        data: {
          id: undefined,
          workoutSessionId: 'session-1',
          exerciseId: 'ex-1',
          actualSets: 4,
          actualReps: 10,
          actualWeightGrams: 18000,
        },
      });
      expect(result).toBeInstanceOf(WorkoutSessionExerciseEntity);
    });
  });

  describe('update', () => {
    it('updates the actual* fields', async () => {
      const entity = new WorkoutSessionExerciseEntity({
        id: 'wse-1',
        workoutSessionId: 'session-1',
        exerciseId: 'ex-1',
        actualSets: 5,
        actualReps: 8,
        actualWeightGrams: 16000,
      });
      prisma.workoutSessionExercise.update.mockResolvedValue({
        ...record,
        actualSets: 5,
        actualReps: 8,
        actualWeightGrams: 16000,
      });

      const result = await repository.update(entity);

      expect(prisma.workoutSessionExercise.update).toHaveBeenCalledWith({
        where: { id: 'wse-1' },
        data: { actualSets: 5, actualReps: 8, actualWeightGrams: 16000 },
      });
      expect(result.actualSets).toBe(5);
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      const entity = new WorkoutSessionExerciseEntity({
        id: 'wse-1',
        workoutSessionId: 'session-1',
        exerciseId: 'ex-1',
        actualSets: 4,
        actualReps: 10,
        actualWeightGrams: 18000,
      });
      prisma.workoutSessionExercise.delete.mockResolvedValue(record);

      await repository.delete(entity);

      expect(prisma.workoutSessionExercise.delete).toHaveBeenCalledWith({
        where: { id: 'wse-1' },
      });
    });
  });
});
