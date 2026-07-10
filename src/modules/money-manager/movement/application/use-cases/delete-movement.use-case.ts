import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { MOVEMENT_REPOSITORY } from '../../domain/ports/movement.repository.port';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';

export type DeleteMovementResponse = {
  id: string;
};

export class DeleteMovementCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class DeleteMovementUseCase {
  constructor(
    @Inject(MOVEMENT_REPOSITORY)
    private readonly repository: MovementRepositoryPort,
  ) {}

  async execute(
    command: DeleteMovementCommand,
  ): Promise<DeleteMovementResponse> {
    try {
      const movement = await this.repository.findById(
        command.id,
        command.userId,
      );
      if (!movement)
        throw new NotFoundException(`Movement "${command.id}" not found`);

      await this.repository.delete(movement);

      return { id: command.id };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error deleting movement: ${error}`);
    }
  }
}
