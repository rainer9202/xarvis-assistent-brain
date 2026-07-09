import * as argon2 from 'argon2';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../../domain/entities/user.entity';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';
import { SignInCommand, SignInUseCase } from './sign-in.use-case';

// `import * as argon2` compiles (under esModuleInterop) to a namespace
// object whose properties are non-configurable getters, so
// `jest.spyOn(argon2, 'verify')` throws "Cannot redefine property". Instead,
// mock the module while keeping the real implementation wrapped in a
// jest.fn() so genuine hashing/verification still happens (every other test
// in this file depends on real argon2 behavior) while calls are trackable.
jest.mock('argon2', () => {
  const actual = jest.requireActual<typeof import('argon2')>('argon2');
  return { ...actual, verify: jest.fn(actual.verify) };
});

describe('SignInUseCase', () => {
  let findByEmail: jest.Mock;
  let repository: UserRepositoryPort;
  let signAsync: jest.Mock;
  let jwtService: JwtService;
  let useCase: SignInUseCase;
  let hashedPassword: string;

  beforeEach(async () => {
    findByEmail = jest.fn();
    repository = { findByEmail, create: jest.fn() };

    signAsync = jest.fn().mockResolvedValue('signed-jwt-token');
    jwtService = { signAsync } as unknown as JwtService;

    useCase = new SignInUseCase(repository, jwtService);
    hashedPassword = await argon2.hash('correct-password');
  });

  it('returns {id, accessToken} on valid credentials', async () => {
    findByEmail.mockResolvedValue(
      new UserEntity({
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: hashedPassword,
      }),
    );

    const result = await useCase.execute(
      new SignInCommand('jane@example.com', 'correct-password'),
    );

    expect(signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    });
    expect(result).toEqual({ id: 'user-1', accessToken: 'signed-jwt-token' });
  });

  it('throws UnauthorizedException when the email does not exist', async () => {
    findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute(new SignInCommand('unknown@example.com', 'whatever')),
    ).rejects.toThrow(UnauthorizedException);
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('runs a dummy argon2.verify on the unknown-email path too, so both branches take comparable time (no email-enumeration timing side-channel)', async () => {
    findByEmail.mockResolvedValue(null);
    (argon2.verify as jest.Mock).mockClear();

    await expect(
      useCase.execute(new SignInCommand('unknown@example.com', 'whatever')),
    ).rejects.toThrow(UnauthorizedException);

    expect(argon2.verify).toHaveBeenCalledTimes(1);
  });

  it('throws UnauthorizedException when the password is wrong, actually verifying via argon2', async () => {
    findByEmail.mockResolvedValue(
      new UserEntity({
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: hashedPassword,
      }),
    );

    await expect(
      useCase.execute(new SignInCommand('jane@example.com', 'wrong-password')),
    ).rejects.toThrow(UnauthorizedException);
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException (not a raw TypeError) when the stored hash is empty', async () => {
    findByEmail.mockResolvedValue(
      new UserEntity({
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: '',
      }),
    );

    await expect(
      useCase.execute(new SignInCommand('jane@example.com', 'whatever')),
    ).rejects.toThrow(UnauthorizedException);
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException (not a raw TypeError) when the stored hash is malformed', async () => {
    findByEmail.mockResolvedValue(
      new UserEntity({
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'not-a-hash',
      }),
    );

    await expect(
      useCase.execute(new SignInCommand('jane@example.com', 'whatever')),
    ).rejects.toThrow(UnauthorizedException);
    expect(signAsync).not.toHaveBeenCalled();
  });
});
