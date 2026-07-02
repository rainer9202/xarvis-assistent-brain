import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  ValidationException,
} from '@shared/exceptions/domain.exception';
import { AccountEntity } from '../../domain/entities/account.entity';
import { ACCOUNT_REPOSITORY } from '../../domain/ports/account.repository.port';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';

export const VALID_ACCOUNT_TYPES = ['cash', 'bank', 'card'];

export type CreateAccountResponse = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
};

export class CreateAccountCommand {
  constructor(
    public readonly name: string,
    public readonly type: string,
  ) {}
}

@Injectable()
export class CreateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly repository: AccountRepositoryPort,
  ) {}

  async execute(
    command: CreateAccountCommand,
  ): Promise<CreateAccountResponse> {
    try {
      if (!VALID_ACCOUNT_TYPES.includes(command.type))
        throw new ValidationException(
          `Account type "${command.type}" is invalid. Must be one of: ${VALID_ACCOUNT_TYPES.join(', ')}`,
        );

      const entity = new AccountEntity({
        name: command.name,
        type: command.type,
        isActive: true,
      });
      const saved = await this.repository.save(entity);

      return {
        id: saved.id!,
        name: saved.name,
        type: saved.type,
        isActive: saved.isActive!,
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error creating account: ${error}`);
    }
  }
}
