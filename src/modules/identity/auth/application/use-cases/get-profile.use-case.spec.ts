import { NotFoundException } from '@domain/exceptions/domain.exception';
import { UserEntity } from '../../domain/entities/user.entity';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';
import { GetProfileUseCase } from './get-profile.use-case';

describe('GetProfileUseCase', () => {
  let findById: jest.Mock;
  let repository: UserRepositoryPort;
  let useCase: GetProfileUseCase;

  beforeEach(() => {
    findById = jest.fn();
    repository = {
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      findById,
      update: jest.fn(),
    };
    useCase = new GetProfileUseCase(repository);
  });

  it('returns the mapped profile when findById hits', async () => {
    findById.mockResolvedValue(
      new UserEntity({
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'hashed-password',
        birthDate: new Date('1990-05-20T00:00:00Z'),
      }),
    );

    const result = await useCase.execute('user-1');

    expect(findById).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      birthDate: '1990-05-20',
    });
  });

  it('throws NotFoundException when findById returns null', async () => {
    findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });
});
