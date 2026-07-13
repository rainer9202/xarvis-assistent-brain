import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { ROUTINE_REPOSITORY } from '../../domain/ports/routine.repository.port';
import type { RoutineRepositoryPort } from '../../domain/ports/routine.repository.port';

export type GetAllRoutinesResponse = {
  id: string;
  name: string;
  isActive: boolean;
  exerciseCount: number;
  createdAt: Date;
};

@Injectable()
export class GetAllRoutinesUseCase {
  constructor(
    @Inject(ROUTINE_REPOSITORY)
    private readonly repository: RoutineRepositoryPort,
  ) {}

  async execute(userId: string): Promise<GetAllRoutinesResponse[]> {
    try {
      const items = await this.repository.findAll(userId);
      return items.map(({ routine, exerciseCount }) => ({
        id: routine.id!,
        name: routine.name,
        isActive: routine.isActive!,
        exerciseCount,
        createdAt: routine.createdAt!,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching routines: ${error}`);
    }
  }
}
