import { ConflictException } from '@domain/exceptions/domain.exception';
import { GroupEntity } from '../../domain/entities/group.entity';
import type { GroupRepositoryPort } from '../../domain/ports/group.repository.port';
import {
  CreateGroupCommand,
  CreateGroupUseCase,
} from './create-group.use-case';

describe('CreateGroupUseCase', () => {
  let findByName: jest.Mock;
  let save: jest.Mock;
  let repository: GroupRepositoryPort;
  let useCase: CreateGroupUseCase;

  beforeEach(() => {
    findByName = jest.fn();
    save = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName,
      save,
      update: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new CreateGroupUseCase(repository);
  });

  it('creates a group defaulting isActive to true', async () => {
    findByName.mockResolvedValue(null);
    let savedEntity: GroupEntity | undefined;
    save.mockImplementation((entity: GroupEntity) => {
      savedEntity = entity;
      return Promise.resolve(
        new GroupEntity({
          id: 'grp-1',
          name: entity.name,
          userId: entity.userId,
          isActive: entity.isActive,
        }),
      );
    });

    const result = await useCase.execute(
      new CreateGroupCommand('Fixed Expenses', 'user-1'),
    );

    expect(findByName).toHaveBeenCalledWith('Fixed Expenses', 'user-1');
    expect(save).toHaveBeenCalledWith(expect.any(GroupEntity));
    expect(savedEntity?.isActive).toBe(true);
    expect(result).toEqual({ id: 'grp-1' });
  });

  it('creates a group with budgetCents when provided', async () => {
    findByName.mockResolvedValue(null);
    let savedEntity: GroupEntity | undefined;
    save.mockImplementation((entity: GroupEntity) => {
      savedEntity = entity;
      return Promise.resolve(
        new GroupEntity({
          id: 'grp-1',
          name: entity.name,
          userId: entity.userId,
          isActive: entity.isActive,
          budgetCents: entity.budgetCents,
        }),
      );
    });

    await useCase.execute(
      new CreateGroupCommand('Fixed Expenses', 'user-1', 5000000),
    );

    expect(savedEntity?.budgetCents).toBe(5000000);
  });

  it('creates a group with budgetCents defaulting to null when omitted', async () => {
    findByName.mockResolvedValue(null);
    let savedEntity: GroupEntity | undefined;
    save.mockImplementation((entity: GroupEntity) => {
      savedEntity = entity;
      return Promise.resolve(
        new GroupEntity({
          id: 'grp-1',
          name: entity.name,
          userId: entity.userId,
          isActive: entity.isActive,
          budgetCents: entity.budgetCents,
        }),
      );
    });

    await useCase.execute(new CreateGroupCommand('Fixed Expenses', 'user-1'));

    expect(savedEntity?.budgetCents).toBeNull();
  });

  it('throws ConflictException when a group with the same name already exists', async () => {
    findByName.mockResolvedValue(
      new GroupEntity({
        id: 'grp-1',
        name: 'Fixed Expenses',
        userId: 'user-1',
        isActive: true,
      }),
    );

    await expect(
      useCase.execute(new CreateGroupCommand('Fixed Expenses', 'user-1')),
    ).rejects.toThrow(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });
});
