import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import {
  ACCOUNT_TYPE_CODES,
  type AccountTypeCode,
} from '../../domain/enums/account-type.enum';
import { ACCOUNT_REPOSITORY } from '../../domain/ports/account.repository.port';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';

export type UpdateAccountResponse = {
  id: string;
};

export class UpdateAccountCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name?: string,
    public readonly type?: string,
    public readonly isActive?: boolean,
    public readonly isPrincipal?: boolean,
  ) {}
}

@Injectable()
export class UpdateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly repository: AccountRepositoryPort,
  ) {}

  async execute(command: UpdateAccountCommand): Promise<UpdateAccountResponse> {
    try {
      const account = await this.repository.findById(
        command.id,
        command.userId,
      );
      if (!account)
        throw new NotFoundException(`Account "${command.id}" not found`);

      if (command.isPrincipal === false)
        throw new ValidationException(
          'Cannot unset the principal account directly — mark a different account as principal instead',
        );

      if (command.name !== undefined) account.name = command.name;
      if (command.type !== undefined) {
        if (!ACCOUNT_TYPE_CODES.includes(command.type as AccountTypeCode))
          throw new ValidationException(
            `Account type "${command.type}" is invalid. Must be one of: ${ACCOUNT_TYPE_CODES.join(', ')}`,
          );
        account.type = command.type;
      }
      if (command.isActive !== undefined) account.isActive = command.isActive;

      const saved = await this.repository.update(account);

      if (command.isPrincipal === true)
        await this.repository.setPrincipal(command.id, command.userId);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error updating account: ${error}`);
    }
  }
}
