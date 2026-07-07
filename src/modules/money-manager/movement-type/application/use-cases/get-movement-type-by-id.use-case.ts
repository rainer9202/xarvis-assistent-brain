import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@shared/exceptions/domain.exception';
import { MOVEMENT_TYPE_REPOSITORY } from '../../domain/ports/movement-type.repository.port';
import type { MovementTypeRepositoryPort } from '../../domain/ports/movement-type.repository.port';

export type GetMovementTypeByIdResponse = {
  id: string;
  name: string;
  isDefault: boolean;
};

@Injectable()
export class GetMovementTypeByIdUseCase {
  constructor(
    @Inject(MOVEMENT_TYPE_REPOSITORY)
    private readonly repository: MovementTypeRepositoryPort,
  ) {}

  async execute(id: string): Promise<GetMovementTypeByIdResponse> {
    try {
      const movementType = await this.repository.findById(id);
      if (!movementType)
        throw new NotFoundException(`Movement type "${id}" not found`);

      return {
        id: movementType.id!,
        name: movementType.name,
        isDefault: movementType.isDefault!,
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching movement type: ${error}`);
    }
  }
}
