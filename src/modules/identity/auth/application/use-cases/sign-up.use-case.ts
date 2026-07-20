import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ConflictException } from '@domain/exceptions/domain.exception';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@domain/ports/transaction-runner.port';
import { AuthTokenIssuer } from '../shared/auth-token-issuer';
import type { AuthResponse } from '../shared/auth-token-issuer';
import { DefaultUserDataProvisioner } from '../shared/default-user-data-provisioner';
import { UserEntity } from '../../domain/entities/user.entity';
import { USER_REPOSITORY } from '../../domain/ports/user.repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';

// Deliberately returns { id, accessToken, refreshToken } instead of
// AGENTS.md's default "Create returns { id: string } only" rule: the client
// needs a working session immediately after registering, so this is a
// documented exception, not an oversight.
export type SignUpResponse = AuthResponse;

export class SignUpCommand {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly password: string,
    public readonly birthDate: string,
  ) {}
}

@Injectable()
export class SignUpUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: UserRepositoryPort,
    private readonly authTokenIssuer: AuthTokenIssuer,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    private readonly provisioner: DefaultUserDataProvisioner,
  ) {}

  async execute(command: SignUpCommand): Promise<SignUpResponse> {
    const existing = await this.repository.findByEmail(command.email);
    if (existing) {
      throw new ConflictException(
        `Email "${command.email}" is already registered`,
      );
    }

    const hashedPassword = await argon2.hash(command.password);
    const entity = new UserEntity({
      name: command.name,
      email: command.email,
      password: hashedPassword,
      birthDate: new Date(command.birthDate),
    });

    // Transactional/all-or-nothing (see design.md): user-create + default-
    // template provisioning commit or roll back as one unit — a
    // provisioning failure must never leave a half-provisioned or
    // compensating-delete-dependent User row behind.
    const saved = await this.transactionRunner.run(async (tx) => {
      const savedUser = await this.repository.create(entity, tx);
      await this.provisioner.provision(savedUser.id!, tx);
      return savedUser;
    });

    return this.authTokenIssuer.issue(saved);
  }
}
