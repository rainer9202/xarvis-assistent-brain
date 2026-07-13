jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { WorkoutSessionEntity } from '../../domain/entities/workout-session.entity';
import { PrismaWorkoutSessionRepository } from './prisma-workout-session.repository';
import type { PrismaService } from '@config/database/prisma.service';

describe('PrismaWorkoutSessionRepository', () => {
  let repository: PrismaWorkoutSessionRepository;
  let prisma: {
    workoutSession: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const record = {
    id: 'session-1',
    userId: 'user-1',
    routineId: 'routine-1',
    date: new Date('2024-01-01T00:00:00Z'),
    finishedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      workoutSession: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    repository = new PrismaWorkoutSessionRepository(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('orders by date desc (most recent first)', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([record]);

      const result = await repository.findAll('user-1');

      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { date: 'desc' },
      });
      expect(result[0]).toBeInstanceOf(WorkoutSessionEntity);
    });
  });

  describe('findByIdWithExercises', () => {
    it('includes exercises and maps to session+exercises', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue({
        ...record,
        exercises: [
          {
            id: 'wse-1',
            workoutSessionId: 'session-1',
            exerciseId: 'ex-1',
            actualSets: 4,
            actualReps: 10,
            actualWeightGrams: 18000,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          },
        ],
      });

      const result = await repository.findByIdWithExercises(
        'session-1',
        'user-1',
      );

      expect(prisma.workoutSession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'user-1' },
        include: { exercises: true },
      });
      expect(result?.exercises).toHaveLength(1);
    });

    it('returns null when not found', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);

      const result = await repository.findByIdWithExercises(
        'missing',
        'user-1',
      );

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('creates a session with the entity fields', async () => {
      const entity = new WorkoutSessionEntity({
        userId: 'user-1',
        routineId: 'routine-1',
        date: record.date,
        finishedAt: null,
      });
      prisma.workoutSession.create.mockResolvedValue(record);

      const result = await repository.save(entity);

      expect(prisma.workoutSession.create).toHaveBeenCalledWith({
        data: {
          id: undefined,
          userId: 'user-1',
          routineId: 'routine-1',
          date: record.date,
          finishedAt: null,
        },
      });
      expect(result).toBeInstanceOf(WorkoutSessionEntity);
    });
  });

  describe('update', () => {
    it('updates finishedAt', async () => {
      const finishedAt = new Date('2024-01-01T02:00:00Z');
      const entity = new WorkoutSessionEntity({
        id: 'session-1',
        userId: 'user-1',
        routineId: 'routine-1',
        date: record.date,
        finishedAt,
      });
      prisma.workoutSession.update.mockResolvedValue({ ...record, finishedAt });

      const result = await repository.update(entity);

      expect(prisma.workoutSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { finishedAt },
      });
      expect(result.finishedAt).toEqual(finishedAt);
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      const entity = new WorkoutSessionEntity({
        id: 'session-1',
        userId: 'user-1',
        routineId: 'routine-1',
        date: record.date,
      });
      prisma.workoutSession.delete.mockResolvedValue(record);

      await repository.delete(entity);

      expect(prisma.workoutSession.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });
  });
});
