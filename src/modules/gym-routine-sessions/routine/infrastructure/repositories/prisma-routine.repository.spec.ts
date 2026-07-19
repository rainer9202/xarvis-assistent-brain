jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { ConflictException } from '@domain/exceptions/domain.exception';
import { RoutineEntity } from '../../domain/entities/routine.entity';
import { PrismaRoutineRepository } from './prisma-routine.repository';
import type { PrismaService } from '@config/database/prisma.service';

describe('PrismaRoutineRepository', () => {
  let repository: PrismaRoutineRepository;
  let tx: {
    routine: { create: jest.Mock; update: jest.Mock };
    routineExercise: { createMany: jest.Mock; deleteMany: jest.Mock };
  };
  let prisma: {
    routine: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    workoutSession: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  const routineRecord = {
    id: 'routine-1',
    name: 'Pecho',
    userId: 'user-1',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  beforeEach(() => {
    tx = {
      routine: { create: jest.fn(), update: jest.fn() },
      routineExercise: { createMany: jest.fn(), deleteMany: jest.fn() },
    };
    prisma = {
      routine: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      workoutSession: { count: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };

    repository = new PrismaRoutineRepository(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('maps _count.exercises to exerciseCount', async () => {
      prisma.routine.findMany.mockResolvedValue([
        { ...routineRecord, _count: { exercises: 5 } },
      ]);

      const result = await repository.findAll('user-1');

      expect(prisma.routine.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { exercises: true } } },
      });
      expect(result[0].exerciseCount).toBe(5);
      expect(result[0].routine).toBeInstanceOf(RoutineEntity);
    });

    it('applies skip/take when page/limit are provided (paginated mode)', async () => {
      prisma.routine.findMany.mockResolvedValue([]);

      await repository.findAll('user-1', 2, 10);

      expect(prisma.routine.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { exercises: true } } },
        skip: 10,
        take: 10,
      });
    });

    it('defaults page to 1 and limit to 20 when only one of them is provided', async () => {
      prisma.routine.findMany.mockResolvedValue([]);

      await repository.findAll('user-1', 3, undefined);

      expect(prisma.routine.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { exercises: true } } },
        skip: 40,
        take: 20,
      });
    });

    it('omits skip/take entirely when neither page nor limit is provided', async () => {
      prisma.routine.findMany.mockResolvedValue([]);

      await repository.findAll('user-1');

      expect(prisma.routine.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { exercises: true } } },
      });
    });
  });

  describe('findByName', () => {
    it('queries the compound unique key name_userId', async () => {
      prisma.routine.findUnique.mockResolvedValue(routineRecord);

      const result = await repository.findByName('Pecho', 'user-1');

      expect(prisma.routine.findUnique).toHaveBeenCalledWith({
        where: { name_userId: { name: 'Pecho', userId: 'user-1' } },
      });
      expect(result).toBeInstanceOf(RoutineEntity);
    });
  });

  describe('save', () => {
    it('creates the routine and its exercises inside one transaction', async () => {
      tx.routine.create.mockResolvedValue(routineRecord);

      const entity = new RoutineEntity({ name: 'Pecho', userId: 'user-1' });
      const result = await repository.save(entity, [
        {
          exerciseId: 'ex-1',
          order: 0,
          targetSets: 4,
          targetReps: 10,
          targetWeightGrams: 20000,
        },
      ]);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.routineExercise.createMany).toHaveBeenCalledWith({
        data: [
          {
            routineId: 'routine-1',
            exerciseId: 'ex-1',
            order: 0,
            targetSets: 4,
            targetReps: 10,
            targetWeightGrams: 20000,
          },
        ],
      });
      expect(result).toBeInstanceOf(RoutineEntity);
    });

    it('skips createMany when the exercise list is empty', async () => {
      tx.routine.create.mockResolvedValue(routineRecord);

      await repository.save(
        new RoutineEntity({ name: 'Pecho', userId: 'user-1' }),
        [],
      );

      expect(tx.routineExercise.createMany).not.toHaveBeenCalled();
    });

    it('maps a P2002 unique-constraint violation to ConflictException', async () => {
      // Closes the TOCTOU race CreateRoutineUseCase's findByName pre-check
      // can't fully close: two concurrent creates for the same (name, userId)
      // can both pass that check, so the losing tx.routine.create() here hits
      // the @@unique([name, userId]) constraint — same duck-typed pattern as
      // PrismaUserRepository.create().
      prisma.$transaction.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
          meta: { target: ['name', 'user_id'] },
        }),
      );

      await expect(
        repository.save(
          new RoutineEntity({ name: 'Pecho', userId: 'user-1' }),
          [],
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rethrows any other error unchanged', async () => {
      const unexpected = new Error('connection refused');
      prisma.$transaction.mockRejectedValue(unexpected);

      await expect(
        repository.save(
          new RoutineEntity({ name: 'Pecho', userId: 'user-1' }),
          [],
        ),
      ).rejects.toThrow(unexpected);
    });
  });

  describe('update', () => {
    it('leaves the exercise list untouched when exercises is undefined', async () => {
      tx.routine.update.mockResolvedValue(routineRecord);

      await repository.update(
        new RoutineEntity({ id: 'routine-1', name: 'Pecho', userId: 'user-1' }),
        undefined,
      );

      expect(tx.routineExercise.deleteMany).not.toHaveBeenCalled();
      expect(tx.routineExercise.createMany).not.toHaveBeenCalled();
    });

    it('full-replaces the exercise list when exercises is provided', async () => {
      tx.routine.update.mockResolvedValue(routineRecord);

      await repository.update(
        new RoutineEntity({ id: 'routine-1', name: 'Pecho', userId: 'user-1' }),
        [
          {
            exerciseId: 'ex-2',
            order: 0,
            targetSets: 3,
            targetReps: 8,
            targetWeightGrams: 15000,
          },
        ],
      );

      expect(tx.routineExercise.deleteMany).toHaveBeenCalledWith({
        where: { routineId: 'routine-1' },
      });
      expect(tx.routineExercise.createMany).toHaveBeenCalledWith({
        data: [
          {
            routineId: 'routine-1',
            exerciseId: 'ex-2',
            order: 0,
            targetSets: 3,
            targetReps: 8,
            targetWeightGrams: 15000,
          },
        ],
      });
    });

    it('clears the exercise list (deleteMany, no createMany) when exercises is an empty array', async () => {
      tx.routine.update.mockResolvedValue(routineRecord);

      await repository.update(
        new RoutineEntity({ id: 'routine-1', name: 'Pecho', userId: 'user-1' }),
        [],
      );

      expect(tx.routineExercise.deleteMany).toHaveBeenCalledWith({
        where: { routineId: 'routine-1' },
      });
      expect(tx.routineExercise.createMany).not.toHaveBeenCalled();
    });

    it('maps a P2002 unique-constraint violation to ConflictException', async () => {
      // Same TOCTOU race as save(), on the rename path.
      prisma.$transaction.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
          meta: { target: ['name', 'user_id'] },
        }),
      );

      await expect(
        repository.update(
          new RoutineEntity({
            id: 'routine-1',
            name: 'Pecho',
            userId: 'user-1',
          }),
          undefined,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('countSessionsByRoutineId', () => {
    it('delegates to prisma.workoutSession.count', async () => {
      prisma.workoutSession.count.mockResolvedValue(2);

      const result = await repository.countSessionsByRoutineId('routine-1');

      expect(prisma.workoutSession.count).toHaveBeenCalledWith({
        where: { routineId: 'routine-1' },
      });
      expect(result).toBe(2);
    });
  });

  describe('countByUserId', () => {
    it('delegates to prisma.routine.count scoped by userId', async () => {
      prisma.routine.count.mockResolvedValue(9);

      const result = await repository.countByUserId('user-1');

      expect(prisma.routine.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toBe(9);
    });
  });
});
