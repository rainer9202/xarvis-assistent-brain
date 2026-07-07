import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  DomainException,
} from '@shared/exceptions/domain.exception';
import { GetMovementTypeByIdUseCase } from '@modules/money-manager/movement-type/application/use-cases/get-movement-type-by-id.use-case';
import { CategoryEntity } from '../../domain/entities/category.entity';
import { CATEGORY_REPOSITORY } from '../../domain/ports/category.repository.port';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';

export type CreateCategoryResponse = {
  id: string;
};

export class CreateCategoryCommand {
  constructor(
    public readonly name: string,
    public readonly movementTypeId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class CreateCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly repository: CategoryRepositoryPort,
    private readonly getMovementTypeById: GetMovementTypeByIdUseCase,
  ) {}

  async execute(
    command: CreateCategoryCommand,
  ): Promise<CreateCategoryResponse> {
    try {
      await this.getMovementTypeById.execute(command.movementTypeId);

      const existing = await this.repository.findByNameAndMovementTypeId(
        command.name,
        command.movementTypeId,
        command.userId,
      );
      if (existing)
        throw new ConflictException(
          `Category "${command.name}" already exists for movement type "${command.movementTypeId}"`,
        );

      const entity = new CategoryEntity({
        name: command.name,
        movementTypeId: command.movementTypeId,
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
