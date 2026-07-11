import { NotFoundException } from '@domain/exceptions/domain.exception';
import { GroupEntity } from '../../domain/entities/group.entity';
import type { GroupRepositoryPort } from '../../domain/ports/group.repository.port';
import {
  DeleteGroupCommand,
  DeleteGroupUseCase,
} from './delete-group.use-case';

describe('DeleteGroupUseCase', () => {
  let findById: jest.Mock;
  let deleteFn: jest.Mock;
  let repository: GroupRepositoryPort;
  let useCase: DeleteGroupUseCase;

  beforeEach(() => {
    findById = jest.fn();
    deleteFn = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      findByName: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: deleteFn,
    };
    useCase = new DeleteGroupUseCase(repository);
  });

  it('deletes an existing group', async () => {
    const existing = new GroupEntity({
      id: 'grp-1',
      name: 'Fixed Expenses',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);

    const result = await useCase.execute(
      new DeleteGroupCommand('grp-1', 'user-1'),
    );

    expect(deleteFn).toHaveBeenCalledWith(existing);
    expect(result).toEqual({ id: 'grp-1' });
  });

  it('throws NotFoundException when the group does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new DeleteGroupCommand('missing', 'user-1')),
    ).rejects.toThrow(NotFoundException);
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
