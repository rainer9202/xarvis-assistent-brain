import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  DomainException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { MOVEMENT_TYPES } from '@domain/enums/movement-type.enum';
import { CategoryEntity } from '../../domain/entities/category.entity';
import { CATEGORY_REPOSITORY } from '../../domain/ports/category.repository.port';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';

export type CreateCategoryResponse = {
  id: string;
};

export class CreateCategoryCommand {
  constructor(
    public readonly name: string,
    public readonly movementType: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class CreateCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly repository: CategoryRepositoryPort,
  ) {}

  async execute(
    command: CreateCategoryCommand,
  ): Promise<CreateCategoryResponse> {
    try {
      if (
        !MOVEMENT_TYPES.includes(
          command.movementType as (typeof MOVEMENT_TYPES)[number],
        )
      )
        throw new ValidationException(
          `Movement type "${command.movementType}" is invalid. Must be one of: ${MOVEMENT_TYPES.join(', ')}`,
        );

      const existing = await this.repository.findByNameAndMovementType(
        command.name,
        command.movementType,
        command.userId,
      );
      if (existing)
        throw new ConflictException(
          `Category "${command.name}" already exists for movement type "${command.movementType}"`,
        );

      const entity = new CategoryEntity({
        name: command.name,
        movementType: command.movementType,
        userId: command.userId,
        isActive: true,
      });
      const saved = await this.repository.save(entity);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error creating category: ${error}`);
    }
  }
}
