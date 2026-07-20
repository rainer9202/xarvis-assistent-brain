import { Inject, Injectable } from '@nestjs/common';
import type { TransactionContext } from '@domain/ports/transaction-runner.port';
import { GroupEntity } from '../../domain/entities/group.entity';
import { DEFAULT_GROUPS } from '../../domain/default-groups';
import { GROUP_REPOSITORY } from '../../domain/ports/group.repository.port';
import type { GroupRepositoryPort } from '../../domain/ports/group.repository.port';

// Batch-provisions the default group set for a brand new user at sign-up
// (see openspec/changes/add-default-user-template). Neither default group
// sets budgetCents (informational-only field, left unset).
@Injectable()
export class ProvisionDefaultGroupsUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly repository: GroupRepositoryPort,
  ) {}

  async execute(userId: string, tx?: TransactionContext): Promise<void> {
    for (const defaultGroup of DEFAULT_GROUPS) {
      const entity = new GroupEntity({
        name: defaultGroup.name,
        userId,
        isActive: true,
      });
      await this.repository.save(entity, tx);
    }
  }
}
