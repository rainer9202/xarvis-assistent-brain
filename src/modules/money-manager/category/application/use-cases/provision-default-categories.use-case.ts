import { Inject, Injectable } from '@nestjs/common';
import type { TransactionContext } from '@domain/ports/transaction-runner.port';
import { CategoryEntity } from '../../domain/entities/category.entity';
import { DEFAULT_CATEGORIES } from '../../domain/default-categories';
import { CATEGORY_REPOSITORY } from '../../domain/ports/category.repository.port';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';

// Batch-provisions the default category set for a brand new user at sign-up
// (see openspec/changes/add-default-user-template). Reuses the same shared
// DEFAULT_CATEGORIES constant as prisma/seed.ts — single source of truth.
@Injectable()
export class ProvisionDefaultCategoriesUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly repository: CategoryRepositoryPort,
  ) {}

  async execute(userId: string, tx?: TransactionContext): Promise<void> {
    for (const defaultCategory of DEFAULT_CATEGORIES) {
      const entity = new CategoryEntity({
        name: defaultCategory.name,
        icon: defaultCategory.icon,
        movementType: defaultCategory.movementType,
        userId,
        isActive: true,
      });
      await this.repository.save(entity, tx);
    }
  }
}
