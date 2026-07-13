import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { WORKOUT_SESSION_REPOSITORY } from '../../domain/ports/workout-session.repository.port';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import { WORKOUT_SESSION_EXERCISE_REPOSITORY } from '../../domain/ports/workout-session-exercise.repository.port';
import type { WorkoutSessionExerciseRepositoryPort } from '../../domain/ports/workout-session-exercise.repository.port';
import { assertWorkoutSessionExerciseBounds } from '../shared/assert-workout-session-exercise-bounds';

export type UpdateWorkoutSessionExerciseResponse = {
  id: string;
};

export class UpdateWorkoutSessionExerciseCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly actualSets?: number,
    public readonly actualReps?: number,
    public readonly actualWeightGrams?: number,
  ) {}
}

@Injectable()
export class UpdateWorkoutSessionExerciseUseCase {
  constructor(
    @Inject(WORKOUT_SESSION_REPOSITORY)
    private readonly sessionRepository: WorkoutSessionRepositoryPort,
    @Inject(WORKOUT_SESSION_EXERCISE_REPOSITORY)
    private readonly repository: WorkoutSessionExerciseRepositoryPort,
  ) {}

  async execute(
    command: UpdateWorkoutSessionExerciseCommand,
  ): Promise<UpdateWorkoutSessionExerciseResponse> {
    try {
      const entry = await this.repository.findById(command.id);
      if (!entry)
        throw new NotFoundException(
          `Workout session exercise "${command.id}" not found`,
        );

      // Two-hop ownership check: this table has no userId column of its
      // own, so ownership is authorized via the parent WorkoutSession.
      const session = await this.sessionRepository.findById(
        entry.workoutSessionId,
        command.userId,
      );
      if (!session)
        throw new NotFoundException(
          `Workout session exercise "${command.id}" not found`,
        );

      // NOT blocked on session.finishedAt — correcting a typo after
      // finishing must still be allowed; only NEW exercise creation is
      // gated on a finished session (see CreateWorkoutSessionExerciseUseCase).

      if (
        command.actualSets !== undefined ||
        command.actualReps !== undefined ||
        command.actualWeightGrams !== undefined
      ) {
        assertWorkoutSessionExerciseBounds({
          actualSets: command.actualSets ?? entry.actualSets,
          actualReps: command.actualReps ?? entry.actualReps,
          actualWeightGrams:
            command.actualWeightGrams ?? entry.actualWeightGrams,
        });
      }

      if (command.actualSets !== undefined)
        entry.actualSets = command.actualSets;
      if (command.actualReps !== undefined)
        entry.actualReps = command.actualReps;
      if (command.actualWeightGrams !== undefined)
        entry.actualWeightGrams = command.actualWeightGrams;

      const saved = await this.repository.update(entry);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(
        `Unexpected error updating workout session exercise: ${error}`,
      );
    }
  }
}
