import { NotFoundException } from '@domain/exceptions/domain.exception';
import { MovementEntity } from '../../domain/entities/movement.entity';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';
import {
  DeleteMovementCommand,
  DeleteMovementUseCase,
} from './delete-movement.use-case';

describe('DeleteMovementUseCase', () => {
  let findById: jest.Mock;
  let deleteFn: jest.Mock;
  let repository: MovementRepositoryPort;
  let useCase: DeleteMovementUseCase;

  beforeEach(() => {
    findById = jest.fn();
    deleteFn = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      save: jest.fn(),
      update: jest.fn(),
      delete: deleteFn,
    };
    useCase = new DeleteMovementUseCase(repository);
  });

  it('deletes the movement when it exists', async () => {
    const entity = new MovementEntity({
      id: 'mov-1',
      amountCents: 1500,
      date: new Date('2024-01-01T00:00:00Z'),
      accountId: 'acc-1',
      categoryId: 'cat-1',
      movementType: 'MT01',
      userId: 'user-1',
    });
    findById.mockResolvedValue(entity);
    deleteFn.mockResolvedValue(undefined);

    const result = await useCase.execute(
      new DeleteMovementCommand('mov-1', 'user-1'),
    );

    expect(findById).toHaveBeenCalledWith('mov-1', 'user-1');
    expect(deleteFn).toHaveBeenCalledWith(entity);
    expect(result).toEqual({ id: 'mov-1' });
  });

  it('throws NotFoundException when the movement does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new DeleteMovementCommand('missing', 'user-1')),
    ).rejects.toThrow(NotFoundException);
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
