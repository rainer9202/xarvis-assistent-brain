import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { AccountEntity } from '../../domain/entities/account.entity';
import { ACCOUNT_TYPES } from '../../domain/enums/account-type.enum';
import { ACCOUNT_REPOSITORY } from '../../domain/ports/account.repository.port';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';

export type CreateAccountResponse = {
  id: string;
};

export class CreateAccountCommand {
  constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class CreateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly repository: AccountRepositoryPort,
  ) {}

  async execute(command: CreateAccountCommand): Promise<CreateAccountResponse> {
    try {
      if (
        !ACCOUNT_TYPES.includes(command.type as (typeof ACCOUNT_TYPES)[number])
      )
        throw new ValidationException(
          `Account type "${command.type}" is invalid. Must be one of: ${ACCOUNT_TYPES.join(', ')}`,
        );

      const entity = new AccountEntity({
        name: command.name,
        type: command.type,
        userId: command.userId,
        isActive: true,
      });
      const saved = await this.repository.save(entity);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error creating account: ${error}`);
    }
  }
}
