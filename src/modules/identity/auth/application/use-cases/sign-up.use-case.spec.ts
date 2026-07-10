import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { ConflictException } from '@domain/exceptions/domain.exception';
import { UserEntity } from '../../domain/entities/user.entity';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';
import { SignUpCommand, SignUpUseCase } from './sign-up.use-case';

describe('SignUpUseCase', () => {
  let findByEmail: jest.Mock;
  let create: jest.Mock;
  let repository: UserRepositoryPort;
  let signAsync: jest.Mock;
  let jwtService: JwtService;
  let useCase: SignUpUseCase;

  beforeEach(() => {
    findByEmail = jest.fn();
    create = jest.fn();
    repository = { findByEmail, create, findAll: jest.fn() };

    signAsync = jest.fn().mockResolvedValue('signed-jwt-token');
    jwtService = { signAsync } as unknown as JwtService;

    useCase = new SignUpUseCase(repository, jwtService);
  });

  it('hashes the password (never persists plaintext) and returns {id, accessToken}', async () => {
    findByEmail.mockResolvedValue(null);
    let savedEntity: UserEntity | undefined;
    create.mockImplementation((entity: UserEntity) => {
      savedEntity = entity;
      return Promise.resolve(
        new UserEntity({
          id: 'user-1',
          name: entity.name,
          email: entity.email,
          password: entity.password,
        }),
      );
    });

    const result = await useCase.execute(
      new SignUpCommand('Jane Doe', 'jane@example.com', 'plaintext-password'),
    );

    expect(findByEmail).toHaveBeenCalledWith('jane@example.com');
    expect(create).toHaveBeenCalledWith(expect.any(UserEntity));
    expect(savedEntity?.password).not.toBe('plaintext-password');
    expect(
      await argon2.verify(savedEntity!.password, 'plaintext-password'),
    ).toBe(true);
    expect(signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    });
    expect(result).toEqual({ id: 'user-1', accessToken: 'signed-jwt-token' });
  });

  it('throws ConflictException when the email is already taken', async () => {
    findByEmail.mockResolvedValue(
      new UserEntity({
        id: 'existing-user',
        name: 'Existing',
        email: 'jane@example.com',
        password: 'hashed',
      }),
    );

    await expect(
      useCase.execute(
        new SignUpCommand('Jane Doe', 'jane@example.com', 'plaintext-password'),
      ),
    ).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  // The TOCTOU race (two concurrent sign-ups for the same email both pass
  // this findByEmail check) is closed at the repository boundary, not here:
  // PrismaUserRepository.create() catches the resulting P2002 unique-
  // constraint violation and throws ConflictException itself — see
  // prisma-user.repository.spec.ts. This use case only needs to let that
  // exception propagate untouched, which it already does by not catching it.
  it('propagates a ConflictException thrown by repository.create() untouched (TOCTOU race)', async () => {
    findByEmail.mockResolvedValue(null);
    create.mockRejectedValue(
      new ConflictException('Email "jane@example.com" is already registered'),
    );

    await expect(
      useCase.execute(
        new SignUpCommand('Jane Doe', 'jane@example.com', 'plaintext-password'),
      ),
    ).rejects.toThrow(ConflictException);
  });
});
