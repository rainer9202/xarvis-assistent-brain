import * as argon2 from 'argon2';
import { ConflictException } from '@domain/exceptions/domain.exception';
import type {
  TransactionContext,
  TransactionRunner,
} from '@domain/ports/transaction-runner.port';
import { UserEntity } from '../../domain/entities/user.entity';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';
import { AuthTokenIssuer } from '../shared/auth-token-issuer';
import type { AuthResponse } from '../shared/auth-token-issuer';
import { DefaultUserDataProvisioner } from '../shared/default-user-data-provisioner';
import { SignUpCommand, SignUpUseCase } from './sign-up.use-case';

describe('SignUpUseCase', () => {
  let findByEmail: jest.Mock;
  let create: jest.Mock<Promise<UserEntity>, [UserEntity, TransactionContext?]>;
  let repository: UserRepositoryPort;
  let issue: jest.Mock;
  let authTokenIssuer: AuthTokenIssuer;
  let run: jest.Mock<
    Promise<unknown>,
    [(tx: TransactionContext) => Promise<unknown>]
  >;
  let transactionRunner: TransactionRunner;
  let provision: jest.Mock<Promise<void>, [string, TransactionContext?]>;
  let provisioner: DefaultUserDataProvisioner;
  let useCase: SignUpUseCase;
  const fakeTx = { fakeTx: true };

  beforeEach(() => {
    findByEmail = jest.fn();
    create = jest.fn<Promise<UserEntity>, [UserEntity, TransactionContext?]>();
    repository = { findByEmail, create, findAll: jest.fn() };

    issue = jest.fn();
    authTokenIssuer = { issue } as unknown as AuthTokenIssuer;

    run = jest
      .fn<Promise<unknown>, [(tx: TransactionContext) => Promise<unknown>]>()
      .mockImplementation((work) => work(fakeTx));
    transactionRunner = { run } as unknown as TransactionRunner;

    provision = jest.fn<Promise<void>, [string, TransactionContext?]>();
    provisioner = {
      provision,
    } as unknown as DefaultUserDataProvisioner;

    useCase = new SignUpUseCase(
      repository,
      authTokenIssuer,
      transactionRunner,
      provisioner,
    );
  });

  it('hashes the password (never persists plaintext) and returns {id, accessToken, refreshToken} via AuthTokenIssuer', async () => {
    findByEmail.mockResolvedValue(null);
    let savedEntity: UserEntity | undefined;
    let savedUser: UserEntity | undefined;
    create.mockImplementation((entity: UserEntity) => {
      savedEntity = entity;
      savedUser = new UserEntity({
        id: 'user-1',
        name: entity.name,
        email: entity.email,
        password: entity.password,
      });
      return Promise.resolve(savedUser);
    });
    provision.mockResolvedValue(undefined);
    const authResponse: AuthResponse = {
      id: 'user-1',
      accessToken: 'signed-access-jwt',
      refreshToken: 'signed-refresh-jwt',
    };
    issue.mockResolvedValue(authResponse);

    const result = await useCase.execute(
      new SignUpCommand(
        'Jane Doe',
        'jane@example.com',
        'plaintext-password',
        '1990-05-20',
      ),
    );

    expect(findByEmail).toHaveBeenCalledWith('jane@example.com');
    expect(run).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.any(UserEntity), fakeTx);
    expect(savedEntity?.password).not.toBe('plaintext-password');
    expect(
      await argon2.verify(savedEntity!.password, 'plaintext-password'),
    ).toBe(true);
    expect(provision).toHaveBeenCalledWith('user-1', fakeTx);
    expect(issue).toHaveBeenCalledWith(savedUser);
    expect(result).toEqual(authResponse);
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
        new SignUpCommand(
          'Jane Doe',
          'jane@example.com',
          'plaintext-password',
          '1990-05-20',
        ),
      ),
    ).rejects.toThrow(ConflictException);
    expect(run).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  // The TOCTOU race (two concurrent sign-ups for the same email both pass
  // this findByEmail check) is closed at the repository boundary, not here:
  // PrismaUserRepository.create() catches the resulting P2002 unique-
  // constraint violation and throws ConflictException itself — see
  // prisma-user.repository.spec.ts. This use case only needs to let that
  // exception propagate untouched (through TransactionRunner.run(), which
  // itself never swallows a throw — see prisma-transaction-runner.spec.ts),
  // which it already does by not catching it.
  it('propagates a ConflictException thrown by repository.create() untouched (TOCTOU race)', async () => {
    findByEmail.mockResolvedValue(null);
    create.mockRejectedValue(
      new ConflictException('Email "jane@example.com" is already registered'),
    );

    await expect(
      useCase.execute(
        new SignUpCommand(
          'Jane Doe',
          'jane@example.com',
          'plaintext-password',
          '1990-05-20',
        ),
      ),
    ).rejects.toThrow(ConflictException);
    expect(provision).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  // Transactional/all-or-nothing per design.md's "Provisioning wiring and
  // failure semantics" ADR: a provisioning failure must reject the whole
  // sign-up (TransactionRunner.run()'s callback throwing propagates, so
  // Postgres rolls back the User insert too — no orphaned/half-provisioned
  // User row, no compensating delete needed).
  it('rejects the whole sign-up when provisioning fails (no partial User row, no AuthTokenIssuer call)', async () => {
    findByEmail.mockResolvedValue(null);
    create.mockImplementation((entity: UserEntity) =>
      Promise.resolve(
        new UserEntity({
          id: 'user-1',
          name: entity.name,
          email: entity.email,
          password: entity.password,
        }),
      ),
    );
    const provisioningError = new Error('default categories insert failed');
    provision.mockRejectedValue(provisioningError);

    await expect(
      useCase.execute(
        new SignUpCommand(
          'Jane Doe',
          'jane@example.com',
          'plaintext-password',
          '1990-05-20',
        ),
      ),
    ).rejects.toThrow(provisioningError);
    expect(issue).not.toHaveBeenCalled();
  });
});
