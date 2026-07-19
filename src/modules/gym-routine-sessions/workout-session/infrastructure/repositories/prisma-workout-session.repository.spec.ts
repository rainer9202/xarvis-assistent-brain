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
      count: jest.Mock;
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
        count: jest.fn(),
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
      prisma.workoutSession.findMany.mockResolvedValue([
        { ...record, _count: { exercises: 0 } },
      ]);

      const result = await repository.findAll('user-1');

      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { date: 'desc' },
        include: { _count: { select: { exercises: true } } },
      });
      expect(result[0].session).toBeInstanceOf(WorkoutSessionEntity);
    });

    it('maps _count.exercises to loggedExerciseCount per session', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([
        { ...record, id: 'session-1', _count: { exercises: 2 } },
        { ...record, id: 'session-2', _count: { exercises: 0 } },
      ]);

      const result = await repository.findAll('user-1');

      expect(result[0].session.id).toBe('session-1');
      expect(result[0].loggedExerciseCount).toBe(2);
      expect(result[1].session.id).toBe('session-2');
      expect(result[1].loggedExerciseCount).toBe(0);
    });

    it('issues a single findMany call regardless of result size (no per-session N+1)', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([
        { ...record, id: 'session-1', _count: { exercises: 1 } },
        { ...record, id: 'session-2', _count: { exercises: 3 } },
        { ...record, id: 'session-3', _count: { exercises: 0 } },
      ]);

      await repository.findAll('user-1');

      expect(prisma.workoutSession.findMany).toHaveBeenCalledTimes(1);
    });

    it('applies skip/take when page/limit are provided (paginated mode)', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([]);

      await repository.findAll('user-1', 2, 10);

      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { date: 'desc' },
        include: { _count: { select: { exercises: true } } },
        skip: 10,
        take: 10,
      });
    });

    it('defaults page to 1 and limit to 20 when only one of them is provided', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([]);

      await repository.findAll('user-1', 3, undefined);

      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { date: 'desc' },
        include: { _count: { select: { exercises: true } } },
        skip: 40,
        take: 20,
      });
    });

    it('omits skip/take entirely when neither page nor limit is provided', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([]);

      await repository.findAll('user-1');

      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { date: 'desc' },
        include: { _count: { select: { exercises: true } } },
      });
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

  describe('countByUserId', () => {
    it('delegates to prisma.workoutSession.count scoped by userId', async () => {
      prisma.workoutSession.count.mockResolvedValue(6);

      const result = await repository.countByUserId('user-1');

      expect(prisma.workoutSession.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toBe(6);
    });
  });
});
