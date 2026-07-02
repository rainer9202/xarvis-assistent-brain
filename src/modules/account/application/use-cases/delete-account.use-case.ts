import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
  ValidationException,
} from '@shared/exceptions/domain.exception';
import { ACCOUNT_REPOSITORY } from '../../domain/ports/account.repository.port';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';

export type DeleteAccountResponse = {
  id: string;
  isActive: boolean;
};

export class DeleteAccountCommand {
  constructor(public readonly id: string) {}
}

@Injectable()
export class DeleteAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly repository: AccountRepositoryPort,
  ) {}

  async execute(command: DeleteAccountCommand): Promise<DeleteAccountResponse> {
    try {
      const account = await this.repository.findById(command.id);
      if (!account)
        throw new NotFoundException(`Account "${command.id}" not found`);

      const referencingMovements =
        await this.repository.countMovementsByAccountId(command.id);
      if (referencingMovements > 0)
        throw new ValidationException(
          'Account cannot be deactivated because it is referenced by existing movements',
        );

      account.isActive = false;
      const saved = await this.repository.update(account);

      return { id: saved.id!, isActive: saved.isActive! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error deleting account: ${error}`);
    }
  }
}
