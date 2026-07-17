import { NotFoundException } from '@domain/exceptions/domain.exception';
import { UserEntity } from '../../domain/entities/user.entity';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  UpdateProfileCommand,
  UpdateProfileUseCase,
} from './update-profile.use-case';

describe('UpdateProfileUseCase', () => {
  let findById: jest.Mock;
  let update: jest.Mock;
  let repository: UserRepositoryPort;
  let useCase: UpdateProfileUseCase;

  const existing = () =>
    new UserEntity({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'hashed-password',
      birthDate: new Date('1990-05-20T00:00:00Z'),
    });

  beforeEach(() => {
    findById = jest.fn();
    update = jest.fn();
    repository = {
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      findById,
      update,
    };
    useCase = new UpdateProfileUseCase(repository);
  });

  it('updates only name, leaving birthDate untouched', async () => {
    findById.mockResolvedValue(existing());
    update.mockImplementation((entity: UserEntity) => Promise.resolve(entity));

    const result = await useCase.execute(
      new UpdateProfileCommand('user-1', 'New Name'),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Name',
        birthDate: new Date('1990-05-20T00:00:00Z'),
      }),
    );
    expect(result).toEqual({
      id: 'user-1',
      name: 'New Name',
      email: 'jane@example.com',
      birthDate: '1990-05-20',
    });
  });

  it('updates only birthDate, leaving name untouched', async () => {
    findById.mockResolvedValue(existing());
    update.mockImplementation((entity: UserEntity) => Promise.resolve(entity));

    const result = await useCase.execute(
      new UpdateProfileCommand('user-1', undefined, '1995-01-01'),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jane Doe',
        birthDate: new Date('1995-01-01'),
      }),
    );
    expect(result.birthDate).toBe('1995-01-01');
    expect(result.name).toBe('Jane Doe');
  });

  it('updates both name and birthDate', async () => {
    findById.mockResolvedValue(existing());
    update.mockImplementation((entity: UserEntity) => Promise.resolve(entity));

    const result = await useCase.execute(
      new UpdateProfileCommand('user-1', 'New Name', '1995-01-01'),
    );

    expect(result).toEqual({
      id: 'user-1',
      name: 'New Name',
      email: 'jane@example.com',
      birthDate: '1995-01-01',
    });
  });

  // ADR-4: the return value is the FULL profile (buildUserProfile output),
  // not { id } — a deliberate, documented exception to AGENTS.md's
  // Update-returns-{id}-only convention (see sign-up.use-case.ts's
  // SignUpResponse precedent for the same pattern).
  it('returns the full UserProfileResponse, not { id } only', async () => {
    findById.mockResolvedValue(existing());
    update.mockImplementation((entity: UserEntity) => Promise.resolve(entity));

    const result = await useCase.execute(
      new UpdateProfileCommand('user-1', 'New Name'),
    );

    expect(Object.keys(result).sort()).toEqual(
      ['birthDate', 'email', 'id', 'name'].sort(),
    );
  });

  it('throws NotFoundException when findById returns null', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new UpdateProfileCommand('missing', 'New Name')),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });
});
