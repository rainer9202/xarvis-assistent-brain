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
  save(entity: CategoryEntity): Promise<CategoryEntity>;
  update(entity: CategoryEntity): Promise<CategoryEntity>;
  delete(entity: CategoryEntity): Promise<void>;
  countMovementsByCategoryId(categoryId: string): Promise<number>;
}

export const CATEGORY_REPOSITORY = Symbol('CategoryRepositoryPort');
