import { GroupEntity } from '../../domain/entities/group.entity';
import type { GroupRepositoryPort } from '../../domain/ports/group.repository.port';
import { GetAllGroupsUseCase } from './get-all-groups.use-case';

describe('GetAllGroupsUseCase', () => {
  let repository: jest.Mocked<GroupRepositoryPort>;
  let useCase: GetAllGroupsUseCase;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new GetAllGroupsUseCase(repository);
  });

  it('maps repository entities to the response shape', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    repository.findAll.mockResolvedValue([
      new GroupEntity({
        id: 'grp-1',
        name: 'Fixed Expenses',
        userId: 'user-1',
        isActive: true,
        createdAt,
      }),
    ]);

    const result = await useCase.execute('user-1');

    expect(repository.findAll).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
      { id: 'grp-1', name: 'Fixed Expenses', isActive: true, createdAt },
    ]);
  });

  it('returns an empty array when there are no groups', async () => {
    repository.findAll.mockResolvedValue([]);

    const result = await useCase.execute('user-1');

    expect(result).toEqual([]);
  });
});
