jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { ExerciseEntity } from '../../domain/entities/exercise.entity';
import { PrismaExerciseRepository } from './prisma-exercise.repository';
import type { PrismaService } from '@config/database/prisma.service';

describe('PrismaExerciseRepository', () => {
  let repository: PrismaExerciseRepository;
  let prisma: {
    exercise: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    routineExercise: {
      count: jest.Mock;
    };
    workoutSessionExercise: {
      count: jest.Mock;
    };
  };

  const record = {
    id: 'ex-1',
    userId: 'user-1',
    name: 'Bicep Curl',
    category: 'upper arms',
    bodyPart: 'upper arms',
    equipment: 'dumbbell',
    target: 'biceps',
    muscleGroup: 'biceps brachii',
    secondaryMuscles: ['forearms'],
    instructions: { en: 'Curl the dumbbell.' },
    image: null,
    gifUrl: null,
    attribution: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      exercise: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      routineExercise: { count: jest.fn() },
      workoutSessionExercise: { count: jest.fn() },
    };

    repository = new PrismaExerciseRepository(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('queries own OR global rows ordered by name asc', async () => {
      prisma.exercise.findMany.mockResolvedValue([record]);

      const result = await repository.findAll('user-1');

      expect(prisma.exercise.findMany).toHaveBeenCalledWith({
        where: { OR: [{ userId: 'user-1' }, { userId: null }] },
        orderBy: { name: 'asc' },
      });
      expect(result[0]).toBeInstanceOf(ExerciseEntity);
    });
  });

  describe('findByIds', () => {
    it('queries own OR global rows scoped to the given ids', async () => {
      prisma.exercise.findMany.mockResolvedValue([record]);

      const result = await repository.findByIds(['ex-1', 'ex-2'], 'user-1');

      expect(prisma.exercise.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['ex-1', 'ex-2'] },
          OR: [{ userId: 'user-1' }, { userId: null }],
        },
      });
      expect(result[0]).toBeInstanceOf(ExerciseEntity);
    });

    it('returns an empty array without querying when given no ids', async () => {
      const result = await repository.findByIds([], 'user-1');

      expect(prisma.exercise.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('queries own OR global for read access', async () => {
      prisma.exercise.findFirst.mockResolvedValue(record);

      const result = await repository.findById('ex-1', 'user-1');

      expect(prisma.exercise.findFirst).toHaveBeenCalledWith({
        where: { id: 'ex-1', OR: [{ userId: 'user-1' }, { userId: null }] },
      });
      expect(result).toBeInstanceOf(ExerciseEntity);
    });
  });

  describe('findOwnById', () => {
    it('queries strictly by userId, excluding global rows', async () => {
      prisma.exercise.findFirst.mockResolvedValue(record);

      const result = await repository.findOwnById('ex-1', 'user-1');

      expect(prisma.exercise.findFirst).toHaveBeenCalledWith({
        where: { id: 'ex-1', userId: 'user-1' },
      });
      expect(result).toBeInstanceOf(ExerciseEntity);
    });

    it('returns null when not found', async () => {
      prisma.exercise.findFirst.mockResolvedValue(null);

      const result = await repository.findOwnById('missing', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('creates a record from the entity', async () => {
      const entity = new ExerciseEntity({ userId: 'user-1', name: 'Curl' });
      prisma.exercise.create.mockResolvedValue(record);

      const result = await repository.save(entity);

      expect(prisma.exercise.create).toHaveBeenCalledWith({
        data: {
          id: undefined,
          userId: 'user-1',
          name: 'Curl',
          category: undefined,
          bodyPart: undefined,
          equipment: undefined,
          target: undefined,
          muscleGroup: undefined,
          secondaryMuscles: [],
          instructions: undefined,
          image: undefined,
          gifUrl: undefined,
          attribution: undefined,
        },
      });
      expect(result).toBeInstanceOf(ExerciseEntity);
    });
  });

  describe('update', () => {
    it('updates only the basic fields', async () => {
      const entity = new ExerciseEntity({
        id: 'ex-1',
        userId: 'user-1',
        name: 'Renamed',
      });
      prisma.exercise.update.mockResolvedValue({ ...record, name: 'Renamed' });

      const result = await repository.update(entity);

      expect(prisma.exercise.update).toHaveBeenCalledWith({
        where: { id: 'ex-1' },
        data: {
          name: 'Renamed',
          category: undefined,
          bodyPart: undefined,
          equipment: undefined,
          target: undefined,
          muscleGroup: undefined,
        },
      });
      expect(result.name).toBe('Renamed');
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      const entity = new ExerciseEntity({
        id: 'ex-1',
        userId: 'user-1',
        name: 'Curl',
      });
      prisma.exercise.delete.mockResolvedValue(record);

      await repository.delete(entity);

      expect(prisma.exercise.delete).toHaveBeenCalledWith({
        where: { id: 'ex-1' },
      });
    });
  });

  describe('countRoutineExercisesByExerciseId', () => {
    it('delegates to prisma.routineExercise.count', async () => {
      prisma.routineExercise.count.mockResolvedValue(3);

      const result = await repository.countRoutineExercisesByExerciseId('ex-1');

      expect(prisma.routineExercise.count).toHaveBeenCalledWith({
        where: { exerciseId: 'ex-1' },
      });
      expect(result).toBe(3);
    });
  });

  describe('countSessionExercisesByExerciseId', () => {
    it('delegates to prisma.workoutSessionExercise.count', async () => {
      prisma.workoutSessionExercise.count.mockResolvedValue(1);

      const result = await repository.countSessionExercisesByExerciseId('ex-1');

      expect(prisma.workoutSessionExercise.count).toHaveBeenCalledWith({
        where: { exerciseId: 'ex-1' },
      });
      expect(result).toBe(1);
    });
  });
});
