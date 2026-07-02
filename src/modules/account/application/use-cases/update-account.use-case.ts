import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@shared/exceptions/domain.exception';
import { ACCOUNT_REPOSITORY } from '../../domain/ports/account.repository.port';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';

export type UpdateAccountResponse = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
};

export class UpdateAccountCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly type?: string,
    public readonly isActive?: boolean,
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
      const account = await this.repository.findById(command.id);
      if (!account)
        throw new NotFoundException(`Account "${command.id}" not found`);

      if (command.name !== undefined) account.name = command.name;
      if (command.type !== undefined) account.type = command.type;
      if (command.isActive !== undefined) account.isActive = command.isActive;

      const saved = await this.repository.update(account);

      return {
        id: saved.id!,
        name: saved.name,
        type: saved.type,
        isActive: saved.isActive!,
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error updating account: ${error}`);
    }
  }
}
