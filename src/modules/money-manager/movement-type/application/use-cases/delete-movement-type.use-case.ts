import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
  ValidationException,
} from '@shared/exceptions/domain.exception';
import { MOVEMENT_TYPE_REPOSITORY } from '../../domain/ports/movement-type.repository.port';
import type { MovementTypeRepositoryPort } from '../../domain/ports/movement-type.repository.port';

export type DeleteMovementTypeResponse = {
  id: string;
};

export class DeleteMovementTypeCommand {
  constructor(public readonly id: string) {}
}

@Injectable()
export class DeleteMovementTypeUseCase {
  constructor(
    @Inject(MOVEMENT_TYPE_REPOSITORY)
    private readonly repository: MovementTypeRepositoryPort,
  ) {}

  async execute(
    command: DeleteMovementTypeCommand,
  ): Promise<DeleteMovementTypeResponse> {
    try {
      const movementType = await this.repository.findById(command.id);
      if (!movementType)
        throw new NotFoundException(`Movement type "${command.id}" not found`);
      if (movementType.isDefault)
        throw new ValidationException(
          'Default movement types cannot be deleted',
        );

      const referencingCategories =
        await this.repository.countCategoriesByMovementTypeId(command.id);
      if (referencingCategories > 0)
        throw new ValidationException(
          'Movement type cannot be deleted because it is referenced by existing categories',
        );

      const referencingMovements =
        await this.repository.countMovementsByMovementTypeId(command.id);
      if (referencingMovements > 0)
        throw new ValidationException(
          'Movement type cannot be deleted because it is referenced by existing movements',
        );

      await this.repository.delete(movementType);

      return { id: command.id };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error deleting movement type: ${error}`);
    }
  }
}
