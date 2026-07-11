import { NotFoundException } from '@domain/exceptions/domain.exception';
import { MovementEntity } from '../../domain/entities/movement.entity';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';
import { GetMovementByIdUseCase } from './get-movement-by-id.use-case';

describe('GetMovementByIdUseCase', () => {
  let findById: jest.Mock;
  let repository: MovementRepositoryPort;
  let useCase: GetMovementByIdUseCase;

  beforeEach(() => {
    findById = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new GetMovementByIdUseCase(repository);
  });

  it('returns the mapped movement when found', async () => {
    findById.mockResolvedValue(
      new MovementEntity({
        id: 'mv-1',
        amountCents: 15000,
        date: new Date('2024-01-01T00:00:00Z'),
        note: 'Groceries',
        accountId: 'acc-1',
        toAccountId: undefined,
        categoryId: 'cat-1',
        movementType: 'MT01',
        userId: 'user-1',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
    );

    const result = await useCase.execute('mv-1', 'user-1');

    expect(findById).toHaveBeenCalledWith('mv-1', 'user-1');
    expect(result).toEqual({
      id: 'mv-1',
      amountCents: 15000,
      date: new Date('2024-01-01T00:00:00Z'),
      note: 'Groceries',
      accountId: 'acc-1',
      toAccountId: undefined,
      categoryId: 'cat-1',
      movementType: 'MT01',
      movementTypeLabel: 'Gasto',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });
  });

  it('falls back movementTypeLabel to the raw code when no label matches', async () => {
    findById.mockResolvedValue(
      new MovementEntity({
        id: 'mv-1',
        amountCents: 15000,
        date: new Date('2024-01-01T00:00:00Z'),
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'MT99',
        userId: 'user-1',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
    );

    const result = await useCase.execute('mv-1', 'user-1');

    expect(result.movementTypeLabel).toBe('MT99');
  });

  it('throws NotFoundException when the movement does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('wraps unexpected errors from the repository in a plain Error', async () => {
    findById.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute('mv-1', 'user-1')).rejects.toThrow(
      'Unexpected error fetching movement',
    );
  });
});
