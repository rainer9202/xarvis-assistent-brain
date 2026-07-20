import { Injectable } from '@nestjs/common';
import type { TransactionContext } from '@domain/ports/transaction-runner.port';
import { ProvisionDefaultAccountsUseCase } from '@modules/money-manager/account/application/use-cases/provision-default-accounts.use-case';
import { ProvisionDefaultCategoriesUseCase } from '@modules/money-manager/category/application/use-cases/provision-default-categories.use-case';
import { ProvisionDefaultGroupsUseCase } from '@modules/money-manager/group/application/use-cases/provision-default-groups.use-case';

// Orchestrates the 3 per-module default-template provisioners for a brand
// new user (see openspec/changes/add-default-user-template). Mirrors
// AuthTokenIssuer's placement under application/shared/ — this isn't itself
// a use case, it composes 3 already-exported ones. Lives in identity/auth
// (not money-manager) because it is sign-up-specific orchestration, not a
// money-manager concern; each ProvisionDefault*UseCase still only injects
// its OWN module's repository port (application -> domain only).
//
// Deliberately does NOT catch/swallow any of the 3 calls — SignUpUseCase
// wraps `provision()` inside a single TransactionRunner.run() alongside
// userRepo.create(), so any throw here must propagate untouched to trigger
// the whole unit's rollback (see design.md's "Provisioning wiring and
// failure semantics" ADR: transactional, no partial/best-effort window).
@Injectable()
export class DefaultUserDataProvisioner {
  constructor(
    private readonly provisionDefaultAccounts: ProvisionDefaultAccountsUseCase,
    private readonly provisionDefaultCategories: ProvisionDefaultCategoriesUseCase,
    private readonly provisionDefaultGroups: ProvisionDefaultGroupsUseCase,
  ) {}

  async provision(userId: string, tx?: TransactionContext): Promise<void> {
    await this.provisionDefaultAccounts.execute(userId, tx);
    await this.provisionDefaultCategories.execute(userId, tx);
    await this.provisionDefaultGroups.execute(userId, tx);
  }
}
