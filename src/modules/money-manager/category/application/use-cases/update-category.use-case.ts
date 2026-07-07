import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  DomainException,
  NotFoundException,
} from '@shared/exceptions/domain.exception';
import { GetMovementTypeByIdUseCase } from '@modules/money-manager/movement-type/application/use-cases/get-movement-type-by-id.use-case';
import { CATEGORY_REPOSITORY } from '../../domain/ports/category.repository.port';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';

export type UpdateCategoryResponse = {
  id: string;
};

export class UpdateCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name?: string,
    public readonly movementTypeId?: string,
    public readonly isActive?: boolean,
  ) {}
}

@Injectable()
export class UpdateCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly repository: CategoryRepositoryPort,
    private readonly getMovementTypeById: GetMovementTypeByIdUseCase,
  ) {}

  async execute(
    command: UpdateCategoryCommand,
  ): Promise<UpdateCategoryResponse> {
    try {
      const category = await this.repository.findById(
        command.id,
        command.userId,
      );
      if (!category)
        throw new NotFoundException(`Category "${command.id}" not found`);

      const uniquenessKeyChanged =
        command.name !== undefined || command.movementTypeId !== undefined;

      if (command.movementTypeId !== undefined) {
        await this.getMovementTypeById.execute(command.movementTypeId);
        category.movementTypeId = command.movementTypeId;
      }
      if (command.name !== undefined) category.name = command.name;
      if (command.isActive !== undefined) category.isActive = command.isActive;

      if (uniquenessKeyChanged) {
        const existing = await this.repository.findByNameAndMovementTypeId(
          category.name,
          category.movementTypeId,
          category.userId,
        );
        if (existing && existing.id !== category.id)
          throw new ConflictException(
            `Category "${category.name}" already exists for movement type "${category.movementTypeId}"`,
          );
      }

      const saved = await this.repository.update(category);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error updating category: ${error}`);
    }
  }
}
