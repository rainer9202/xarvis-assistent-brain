import { NotFoundException } from '@shared/exceptions/domain.exception';
import { MovementTypeEntity } from '../../domain/entities/movement-type.entity';
import type { MovementTypeRepositoryPort } from '../../domain/ports/movement-type.repository.port';
import { GetMovementTypeByIdUseCase } from './get-movement-type-by-id.use-case';

describe('GetMovementTypeByIdUseCase', () => {
  let findById: jest.Mock;
  let repository: MovementTypeRepositoryPort;
  let useCase: GetMovementTypeByIdUseCase;

  beforeEach(() => {
    findById = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      findByName: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new GetMovementTypeByIdUseCase(repository);
  });

  it('returns the mapped movement type when found', async () => {
    findById.mockResolvedValue(
      new MovementTypeEntity({ id: 'mt-1', name: 'expense', isDefault: true }),
    );

    const result = await useCase.execute('mt-1');

    expect(findById).toHaveBeenCalledWith('mt-1');
    expect(result).toEqual({ id: 'mt-1', name: 'expense', isDefault: true });
  });

  it('throws NotFoundException when the movement type does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('wraps unexpected errors from the repository in a plain Error', async () => {
    findById.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute('mt-1')).rejects.toThrow(
      'Unexpected error fetching movement type',
    );
  });
});
