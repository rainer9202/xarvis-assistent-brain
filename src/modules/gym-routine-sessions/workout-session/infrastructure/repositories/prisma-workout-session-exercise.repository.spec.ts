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
      findMany: jest.Mock;
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
        findMany: jest.fn(),
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

  describe('findLoggedEntriesForExercise', () => {
    it('runs a single findMany call scoped by exerciseId and parent workoutSession.userId, joining routine name, ordered by session date asc (ADR-4, no N+1)', async () => {
      const rows = [
        {
          id: 'wse-1',
          workoutSessionId: 'session-1',
          exerciseId: 'ex-1',
          actualSets: 4,
          actualReps: 10,
          actualWeightGrams: 18000,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
          workoutSession: {
            id: 'session-1',
            date: new Date('2024-01-01T00:00:00Z'),
            routine: { id: 'routine-1', name: 'Push Day' },
          },
        },
      ];
      prisma.workoutSessionExercise.findMany.mockResolvedValue(rows);

      const result = await repository.findLoggedEntriesForExercise(
        'ex-1',
        'user-1',
      );

      expect(prisma.workoutSessionExercise.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.workoutSessionExercise.findMany).toHaveBeenCalledWith({
        where: { exerciseId: 'ex-1', workoutSession: { userId: 'user-1' } },
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
      expect(result).toEqual([
        {
          sessionId: 'session-1',
          sessionDate: new Date('2024-01-01T00:00:00Z'),
          routineId: 'routine-1',
          routineName: 'Push Day',
          actualSets: 4,
          actualReps: 10,
          actualWeightGrams: 18000,
        },
      ]);
    });

    it('returns an empty array when the exercise was never logged', async () => {
      prisma.workoutSessionExercise.findMany.mockResolvedValue([]);

      const result = await repository.findLoggedEntriesForExercise(
        'ex-1',
        'user-1',
      );

      expect(result).toEqual([]);
    });
  });
});
