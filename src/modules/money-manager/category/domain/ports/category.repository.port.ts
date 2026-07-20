import type { TransactionContext } from '@domain/ports/transaction-runner.port';
import { CategoryEntity } from '../entities/category.entity';

export interface CategoryRepositoryPort {
  findAll(userId: string): Promise<CategoryEntity[]>;
  findById(id: string, userId: string): Promise<CategoryEntity | null>;
  findOwnById(id: string, userId: string): Promise<CategoryEntity | null>;
  findByNameAndMovementType(
    name: string,
    movementType: string,
    userId: string,
  ): Promise<CategoryEntity | null>;
  // tx is an optional trailing param (see TransactionRunner design decision)
  // so a batch provisioner (e.g. ProvisionDefaultCategoriesUseCase) can
  // thread the same transaction client through every save() call. Existing
  // no-arg call sites (CreateCategoryUseCase, etc.) are unaffected.
  save(
    entity: CategoryEntity,
    tx?: TransactionContext,
  ): Promise<CategoryEntity>;
  update(entity: CategoryEntity): Promise<CategoryEntity>;
  delete(entity: CategoryEntity): Promise<void>;
  countMovementsByCategoryId(categoryId: string): Promise<number>;
}

export const CATEGORY_REPOSITORY = Symbol('CategoryRepositoryPort');
