import { Inject, Injectable } from '@nestjs/common';
import { MovementTypeEntity } from '../../domain/entities/movement-type.entity';
import { DomainException } from '@shared/exceptions/domain.exception';
import { MOVEMENT_TYPE_REPOSITORY } from '../../domain/ports/movement-type.repository.port';
import type { MovementTypeRepositoryPort } from '../../domain/ports/movement-type.repository.port';

export type GetAllMovementTypesResponse = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
};

@Injectable()
export class GetAllMovementTypesUseCase {
  constructor(
    @Inject(MOVEMENT_TYPE_REPOSITORY)
    private readonly repository: MovementTypeRepositoryPort,
  ) {}

  async execute(): Promise<GetAllMovementTypesResponse[]> {
    try {
      const entities = await this.repository.findAll();
      return entities.map((item: MovementTypeEntity) => ({
        id: item.id!,
        name: item.name,
        isDefault: item.isDefault!,
        createdAt: item.createdAt!,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching movement types: ${error}`);
    }
  }
}
