import { Inject, Injectable } from '@nestjs/common';
import type { TransactionContext } from '@domain/ports/transaction-runner.port';
import { AccountEntity } from '../../domain/entities/account.entity';
import { DEFAULT_ACCOUNTS } from '../../domain/default-accounts';
import { ACCOUNT_REPOSITORY } from '../../domain/ports/account.repository.port';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';

// Batch-provisions the default account set for a brand new user at sign-up
// (see openspec/changes/add-default-user-template). `isPrincipal` is set
// explicitly per DEFAULT_ACCOUNTS entry — this intentionally does NOT reuse
// CreateAccountUseCase's `accountCount === 0` inference, since all 3
// defaults are created together in the same batch.
@Injectable()
export class ProvisionDefaultAccountsUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly repository: AccountRepositoryPort,
  ) {}

  async execute(userId: string, tx?: TransactionContext): Promise<void> {
    for (const defaultAccount of DEFAULT_ACCOUNTS) {
      const entity = new AccountEntity({
        name: defaultAccount.name,
        type: defaultAccount.type,
        userId,
        isActive: true,
        isPrincipal: defaultAccount.isPrincipal,
      });
      await this.repository.save(entity, tx);
    }
  }
}
