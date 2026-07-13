import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { ROUTINE_REPOSITORY } from '../../domain/ports/routine.repository.port';
import type { RoutineRepositoryPort } from '../../domain/ports/routine.repository.port';

export type DeleteRoutineResponse = {
  id: string;
};

export class DeleteRoutineCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class DeleteRoutineUseCase {
  constructor(
    @Inject(ROUTINE_REPOSITORY)
    private readonly repository: RoutineRepositoryPort,
  ) {}

  async execute(command: DeleteRoutineCommand): Promise<DeleteRoutineResponse> {
    try {
      const routine = await this.repository.findById(
        command.id,
        command.userId,
      );
      if (!routine)
        throw new NotFoundException(`Routine "${command.id}" not found`);

      const referencingSessions =
        await this.repository.countSessionsByRoutineId(command.id);
      if (referencingSessions > 0)
        throw new ValidationException(
          'Routine cannot be deleted because it is referenced by existing workout sessions',
        );

      await this.repository.delete(routine);

      return { id: command.id };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error deleting routine: ${error}`);
    }
  }
}
