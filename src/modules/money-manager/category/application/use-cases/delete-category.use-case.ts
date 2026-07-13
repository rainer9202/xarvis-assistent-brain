import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { CATEGORY_REPOSITORY } from '../../domain/ports/category.repository.port';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';

export type DeleteCategoryResponse = {
  id: string;
};

export class DeleteCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class DeleteCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly repository: CategoryRepositoryPort,
  ) {}

  async execute(
    command: DeleteCategoryCommand,
  ): Promise<DeleteCategoryResponse> {
    try {
      const category = await this.repository.findOwnById(
        command.id,
        command.userId,
      );
      if (!category)
        throw new NotFoundException(`Category "${command.id}" not found`);

      const referencingMovements =
        await this.repository.countMovementsByCategoryId(command.id);
      if (referencingMovements > 0)
        throw new ValidationException(
          'Category cannot be deleted because it is referenced by existing movements',
        );

      await this.repository.delete(category);

      return { id: command.id };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error deleting category: ${error}`);
    }
  }
}
