import {
  ConflictException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { GroupEntity } from '../../domain/entities/group.entity';
import type { GroupRepositoryPort } from '../../domain/ports/group.repository.port';
import {
  UpdateGroupCommand,
  UpdateGroupUseCase,
} from './update-group.use-case';

describe('UpdateGroupUseCase', () => {
  let findById: jest.Mock;
  let findByName: jest.Mock;
  let update: jest.Mock;
  let repository: GroupRepositoryPort;
  let useCase: UpdateGroupUseCase;

  beforeEach(() => {
    findById = jest.fn();
    findByName = jest.fn();
    update = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      findByName,
      save: jest.fn(),
      update,
      delete: jest.fn(),
    };
    useCase = new UpdateGroupUseCase(repository);
  });

  it('applies only the provided fields', async () => {
    const existing = new GroupEntity({
      id: 'grp-1',
      name: 'Fixed Expenses',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    findByName.mockResolvedValue(null);
    update.mockImplementation((entity: GroupEntity) => Promise.resolve(entity));

    const result = await useCase.execute(
      new UpdateGroupCommand('grp-1', 'user-1', 'Variable Expenses'),
    );

    expect(findByName).toHaveBeenCalledWith('Variable Expenses', 'user-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Variable Expenses', isActive: true }),
    );
    expect(result).toEqual({ id: 'grp-1' });
  });

  it('throws NotFoundException when the group does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new UpdateGroupCommand('missing', 'user-1', 'Renamed')),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the new name collides with another group', async () => {
    const existing = new GroupEntity({
      id: 'grp-1',
      name: 'Fixed Expenses',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    findByName.mockResolvedValue(
      new GroupEntity({
        id: 'grp-2',
        name: 'Variable Expenses',
        userId: 'user-1',
        isActive: true,
      }),
    );

    await expect(
      useCase.execute(
        new UpdateGroupCommand('grp-1', 'user-1', 'Variable Expenses'),
      ),
    ).rejects.toThrow(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('does not re-check uniqueness when name is unchanged', async () => {
    const existing = new GroupEntity({
      id: 'grp-1',
      name: 'Fixed Expenses',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    update.mockImplementation((entity: GroupEntity) => Promise.resolve(entity));

    const result = await useCase.execute(
      new UpdateGroupCommand('grp-1', 'user-1', undefined, false),
    );

    expect(findByName).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'grp-1' });
  });

  it('sets budgetCents when a number is provided', async () => {
    const existing = new GroupEntity({
      id: 'grp-1',
      name: 'Fixed Expenses',
      userId: 'user-1',
      isActive: true,
      budgetCents: null,
    });
    findById.mockResolvedValue(existing);
    update.mockImplementation((entity: GroupEntity) => Promise.resolve(entity));

    await useCase.execute(
      new UpdateGroupCommand('grp-1', 'user-1', undefined, undefined, 5000000),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ budgetCents: 5000000 }),
    );
  });

  it('clears budgetCents when explicitly set to null', async () => {
    const existing = new GroupEntity({
      id: 'grp-1',
      name: 'Fixed Expenses',
      userId: 'user-1',
      isActive: true,
      budgetCents: 5000000,
    });
    findById.mockResolvedValue(existing);
    update.mockImplementation((entity: GroupEntity) => Promise.resolve(entity));

    await useCase.execute(
      new UpdateGroupCommand('grp-1', 'user-1', undefined, undefined, null),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ budgetCents: null }),
    );
  });

  it('leaves budgetCents untouched when omitted', async () => {
    const existing = new GroupEntity({
      id: 'grp-1',
      name: 'Fixed Expenses',
      userId: 'user-1',
      isActive: true,
      budgetCents: 5000000,
    });
    findById.mockResolvedValue(existing);
    update.mockImplementation((entity: GroupEntity) => Promise.resolve(entity));

    await useCase.execute(
      new UpdateGroupCommand('grp-1', 'user-1', undefined, false),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ budgetCents: 5000000 }),
    );
  });
});
