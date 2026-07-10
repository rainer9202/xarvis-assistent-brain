import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { ACCOUNT_REPOSITORY } from '../../domain/ports/account.repository.port';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';

export type DeleteAccountResponse = {
  id: string;
};

export class DeleteAccountCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class DeleteAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly repository: AccountRepositoryPort,
  ) {}

  async execute(command: DeleteAccountCommand): Promise<DeleteAccountResponse> {
    try {
      const account = await this.repository.findById(
        command.id,
        command.userId,
      );
      if (!account)
        throw new NotFoundException(`Account "${command.id}" not found`);

      if (account.isPrincipal)
        throw new ValidationException(
          'The principal account cannot be deleted — mark a different account as principal first',
        );

      const referencingMovements =
        await this.repository.countMovementsByAccountId(command.id);
      if (referencingMovements > 0)
        throw new ValidationException(
          'Account cannot be deleted because it is referenced by existing movements',
        );

      await this.repository.delete(account);

      return { id: command.id };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error deleting account: ${error}`);
    }
  }
}
