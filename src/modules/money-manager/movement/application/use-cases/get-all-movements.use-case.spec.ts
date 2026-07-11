import { MovementEntity } from '../../domain/entities/movement.entity';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';
import { GetAllMovementsUseCase } from './get-all-movements.use-case';

describe('GetAllMovementsUseCase', () => {
  let repository: jest.Mocked<MovementRepositoryPort>;
  let useCase: GetAllMovementsUseCase;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new GetAllMovementsUseCase(repository);
  });

  it('maps repository entities to the response shape', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const date = new Date('2024-01-02T00:00:00Z');
    const entity = new MovementEntity({
      id: 'mov-1',
      amountCents: 1500,
      date,
      note: 'Weekly groceries',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      movementType: 'MT01',
      userId: 'user-1',
      createdAt,
    });
    repository.findAll.mockResolvedValue([entity]);

    const result = await useCase.execute('user-1');

    expect(repository.findAll).toHaveBeenCalledWith('user-1', undefined);
    expect(result).toEqual([
      {
        id: 'mov-1',
        amountCents: 1500,
        date,
        note: 'Weekly groceries',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'MT01',
        movementTypeLabel: 'Gasto',
        createdAt,
      },
    ]);
  });

  it('falls back movementTypeLabel to the raw code when no label matches', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const date = new Date('2024-01-02T00:00:00Z');
    const entity = new MovementEntity({
      id: 'mov-1',
      amountCents: 1500,
      date,
      accountId: 'acc-1',
      categoryId: 'cat-1',
      movementType: 'MT99',
      userId: 'user-1',
      createdAt,
    });
    repository.findAll.mockResolvedValue([entity]);

    const result = await useCase.execute('user-1');

    expect(result[0].movementTypeLabel).toBe('MT99');
  });

  it('includes toAccountId for a transfer movement', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const date = new Date('2024-01-02T00:00:00Z');
    const entity = new MovementEntity({
      id: 'mov-2',
      amountCents: 20000,
      date,
      accountId: 'acc-1',
      toAccountId: 'acc-2',
      categoryId: 'cat-1',
      movementType: 'MT03',
      userId: 'user-1',
      createdAt,
    });
    repository.findAll.mockResolvedValue([entity]);

    const result = await useCase.execute('user-1');

    expect(result[0].toAccountId).toBe('acc-2');
  });

  it('returns an empty array when there are no movements', async () => {
    repository.findAll.mockResolvedValue([]);

    const result = await useCase.execute('user-1');

    expect(result).toEqual([]);
  });
});
