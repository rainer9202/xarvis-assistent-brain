import { MovementTypeEntity } from '../../domain/entities/movement-type.entity';
import type { MovementTypeRepositoryPort } from '../../domain/ports/movement-type.repository.port';
import { GetAllMovementTypesUseCase } from './get-all-movement-types.use-case';

describe('GetAllMovementTypesUseCase', () => {
  let repository: jest.Mocked<MovementTypeRepositoryPort>;
  let useCase: GetAllMovementTypesUseCase;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new GetAllMovementTypesUseCase(repository);
  });

  it('maps repository entities to the response shape', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const entity = new MovementTypeEntity({
      id: 'mt-1',
      name: 'expense',
      isDefault: true,
      createdAt,
    });
    repository.findAll.mockResolvedValue([entity]);

    const result = await useCase.execute();

    expect(result).toEqual([
      { id: 'mt-1', name: 'expense', isDefault: true, createdAt },
    ]);
  });

  it('returns an empty array when there are no movement types', async () => {
    repository.findAll.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });

  it('wraps unexpected errors from the repository in a plain Error', async () => {
    repository.findAll.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute()).rejects.toThrow(
      'Unexpected error fetching movement types',
    );
  });
});
