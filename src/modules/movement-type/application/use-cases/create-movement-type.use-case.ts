import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  DomainException,
} from '@shared/exceptions/domain.exception';
import { MovementTypeEntity } from '../../domain/entities/movement-type.entity';
import { MOVEMENT_TYPE_REPOSITORY } from '../../domain/ports/movement-type.repository.port';
import type { MovementTypeRepositoryPort } from '../../domain/ports/movement-type.repository.port';

export type CreateMovementTypeResponse = {
  name: string;
};

export class CreateMovementTypeCommand {
  constructor(public readonly name: string) {}
}

@Injectable()
export class CreateMovementTypeUseCase {
  constructor(
    @Inject(MOVEMENT_TYPE_REPOSITORY)
    private readonly repository: MovementTypeRepositoryPort,
  ) {}

  async execute(
    command: CreateMovementTypeCommand,
  ): Promise<CreateMovementTypeResponse> {
    try {
      const existing = await this.repository.findByName(command.name);
      if (existing)
        throw new ConflictException(
          `Movement type "${command.name}" already exists`,
        );

      const entity = new MovementTypeEntity({ name: command.name });
      await this.repository.save(entity);

      return { name: command.name };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error creating movement type: ${error}`);
    }
  }
}
