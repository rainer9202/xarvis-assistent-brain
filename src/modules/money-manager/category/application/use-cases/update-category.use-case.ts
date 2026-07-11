import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  DomainException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { MOVEMENT_TYPE_CODES } from '@domain/enums/movement-type.enum';
import type { MovementTypeCode } from '@domain/enums/movement-type.enum';
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
    public readonly movementType?: string,
    public readonly isActive?: boolean,
  ) {}
}

@Injectable()
export class UpdateCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly repository: CategoryRepositoryPort,
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
        command.name !== undefined || command.movementType !== undefined;

      if (command.movementType !== undefined) {
        if (
          !MOVEMENT_TYPE_CODES.includes(
            command.movementType as MovementTypeCode,
          )
        )
          throw new ValidationException(
            `Movement type "${command.movementType}" is invalid. Must be one of: ${MOVEMENT_TYPE_CODES.join(', ')}`,
          );
        category.movementType = command.movementType;
      }
      if (command.name !== undefined) category.name = command.name;
      if (command.isActive !== undefined) category.isActive = command.isActive;

      if (uniquenessKeyChanged) {
        const existing = await this.repository.findByNameAndMovementType(
          category.name,
          category.movementType,
          category.userId,
        );
        if (existing && existing.id !== category.id)
          throw new ConflictException(
            `Category "${category.name}" already exists for movement type "${category.movementType}"`,
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
