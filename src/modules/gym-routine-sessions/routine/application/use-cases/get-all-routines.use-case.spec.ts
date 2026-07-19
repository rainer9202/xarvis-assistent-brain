import { RoutineEntity } from '../../domain/entities/routine.entity';
import type { RoutineRepositoryPort } from '../../domain/ports/routine.repository.port';
import { GetAllRoutinesUseCase } from './get-all-routines.use-case';

describe('GetAllRoutinesUseCase', () => {
  let findAll: jest.Mock;
  let repository: RoutineRepositoryPort;
  let useCase: GetAllRoutinesUseCase;

  beforeEach(() => {
    findAll = jest.fn();
    repository = {
      findAll,
      findById: jest.fn(),
      findByIdWithExercises: jest.fn(),
      findByName: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countSessionsByRoutineId: jest.fn(),
      countByUserId: jest.fn(),
    };
    useCase = new GetAllRoutinesUseCase(repository);
  });

  it('maps routines to a lightweight list view with exerciseCount', async () => {
    findAll.mockResolvedValue([
      {
        routine: new RoutineEntity({
          id: 'routine-1',
          name: 'Pecho',
          userId: 'user-1',
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
        }),
        exerciseCount: 3,
      },
    ]);

    const result = await useCase.execute('user-1');

    expect(findAll).toHaveBeenCalledWith('user-1', undefined, undefined);
    expect(result.items).toEqual([
      {
        id: 'routine-1',
        name: 'Pecho',
        isActive: true,
        exerciseCount: 3,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      },
    ]);
    expect(result.pagination).toBeUndefined();
  });

  it('does not call countByUserId when neither page nor limit is provided', async () => {
    findAll.mockResolvedValue([]);

    await useCase.execute('user-1');

    expect(repository.countByUserId).not.toHaveBeenCalled();
  });

  it('adds pagination metadata as a sibling of items when page/limit are provided', async () => {
    findAll.mockResolvedValue([
      {
        routine: new RoutineEntity({
          id: 'routine-1',
          name: 'Pecho',
          userId: 'user-1',
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
        }),
        exerciseCount: 3,
      },
    ]);
    (repository.countByUserId as jest.Mock).mockResolvedValue(25);

    const result = await useCase.execute('user-1', 1, 10);

    expect(findAll).toHaveBeenCalledWith('user-1', 1, 10);
    expect(repository.countByUserId).toHaveBeenCalledWith('user-1');
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      totalCount: 25,
      totalPages: 3,
      hasMore: true,
    });
  });
});
