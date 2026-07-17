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
      groupBy: jest.Mock;
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
        groupBy: jest.fn(),
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

  describe('findPersonalRecords', () => {
    it('runs groupBy (_max per exerciseId) then a single findMany matched on the resulting pairs, re-scoped by userId, joined to exercise + routine, ordered date asc, and maps to PersonalRecordEntry (ADR-2, no N+1)', async () => {
      prisma.workoutSessionExercise.groupBy.mockResolvedValue([
        { exerciseId: 'ex-1', _max: { actualWeightGrams: 20000 } },
        { exerciseId: 'ex-2', _max: { actualWeightGrams: 15000 } },
      ]);
      const rows = [
        {
          id: 'wse-1',
          workoutSessionId: 'session-1',
          exerciseId: 'ex-1',
          actualSets: 4,
          actualReps: 10,
          actualWeightGrams: 20000,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
          exercise: { name: 'Bench Press' },
          workoutSession: {
            id: 'session-1',
            date: new Date('2024-01-01T00:00:00Z'),
            routine: { id: 'routine-1', name: 'Push Day' },
          },
        },
        {
          id: 'wse-2',
          workoutSessionId: 'session-2',
          exerciseId: 'ex-2',
          actualSets: 3,
          actualReps: 12,
          actualWeightGrams: 15000,
          createdAt: new Date('2024-02-01T00:00:00Z'),
          updatedAt: new Date('2024-02-01T00:00:00Z'),
          exercise: { name: 'Squat' },
          workoutSession: {
            id: 'session-2',
            date: new Date('2024-02-01T00:00:00Z'),
            routine: { id: 'routine-2', name: 'Leg Day' },
          },
        },
      ];
      prisma.workoutSessionExercise.findMany.mockResolvedValue(rows);

      const result = await repository.findPersonalRecords('user-1');

      expect(prisma.workoutSessionExercise.groupBy).toHaveBeenCalledWith({
        by: ['exerciseId'],
        where: { workoutSession: { userId: 'user-1' } },
        _max: { actualWeightGrams: true },
      });
      expect(prisma.workoutSessionExercise.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.workoutSessionExercise.findMany).toHaveBeenCalledWith({
        where: {
          workoutSession: { userId: 'user-1' },
          OR: [
            { exerciseId: 'ex-1', actualWeightGrams: 20000 },
            { exerciseId: 'ex-2', actualWeightGrams: 15000 },
          ],
        },
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
      expect(prisma.workoutSessionExercise.groupBy).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          exerciseId: 'ex-1',
          exerciseName: 'Bench Press',
          maxWeightGrams: 20000,
          sessionId: 'session-1',
          sessionDate: new Date('2024-01-01T00:00:00Z'),
          routineId: 'routine-1',
          routineName: 'Push Day',
        },
        {
          exerciseId: 'ex-2',
          exerciseName: 'Squat',
          maxWeightGrams: 15000,
          sessionId: 'session-2',
          sessionDate: new Date('2024-02-01T00:00:00Z'),
          routineId: 'routine-2',
          routineName: 'Leg Day',
        },
      ]);
    });

    it('filters out groupBy rows with a null _max before building pairs', async () => {
      prisma.workoutSessionExercise.groupBy.mockResolvedValue([
        { exerciseId: 'ex-1', _max: { actualWeightGrams: null } },
        { exerciseId: 'ex-2', _max: { actualWeightGrams: 15000 } },
      ]);
      prisma.workoutSessionExercise.findMany.mockResolvedValue([
        {
          id: 'wse-2',
          workoutSessionId: 'session-2',
          exerciseId: 'ex-2',
          actualSets: 3,
          actualReps: 12,
          actualWeightGrams: 15000,
          createdAt: new Date('2024-02-01T00:00:00Z'),
          updatedAt: new Date('2024-02-01T00:00:00Z'),
          exercise: { name: 'Squat' },
          workoutSession: {
            id: 'session-2',
            date: new Date('2024-02-01T00:00:00Z'),
            routine: { id: 'routine-2', name: 'Leg Day' },
          },
        },
      ]);

      await repository.findPersonalRecords('user-1');

      expect(prisma.workoutSessionExercise.findMany).toHaveBeenCalledWith({
        where: {
          workoutSession: { userId: 'user-1' },
          OR: [{ exerciseId: 'ex-2', actualWeightGrams: 15000 }],
        },
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
    });

    it('returns [] and never calls findMany when groupBy yields no usable pairs (empty result or all-null _max)', async () => {
      prisma.workoutSessionExercise.groupBy.mockResolvedValue([]);

      const result = await repository.findPersonalRecords('user-1');

      expect(result).toEqual([]);
      expect(prisma.workoutSessionExercise.findMany).not.toHaveBeenCalled();
    });
  });
});
