import { Inject, Injectable } from '@nestjs/common';
import { WORKOUT_SESSION_EXERCISE_REPOSITORY } from '../../domain/ports/workout-session-exercise.repository.port';
import type { WorkoutSessionExerciseRepositoryPort } from '../../domain/ports/workout-session-exercise.repository.port';

export type PersonalRecordResponseEntry = {
  exerciseId: string;
  exerciseName: string;
  maxWeightGrams: number;
  sessionId: string;
  sessionDate: Date;
  routineId: string;
  routineName: string;
};

@Injectable()
export class GetPersonalRecordsUseCase {
  constructor(
    @Inject(WORKOUT_SESSION_EXERCISE_REPOSITORY)
    private readonly repository: WorkoutSessionExerciseRepositoryPort,
  ) {}

  async execute(userId: string): Promise<PersonalRecordResponseEntry[]> {
    const rows = await this.repository.findPersonalRecords(userId);

    // Rows are ordered earliest-date-first (repository's Q2 orderBy asc,
    // design.md ADR-2) — this has-guard keeps only the FIRST seen row per
    // exerciseId. A plain `.set()` per iteration would overwrite on every
    // row and silently flip the tie-break to latest-wins (design.md ADR-3).
    const byExercise = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!byExercise.has(row.exerciseId)) byExercise.set(row.exerciseId, row);
    }

    return Array.from(byExercise.values()).map((row) => ({
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseName,
      maxWeightGrams: row.maxWeightGrams,
      sessionId: row.sessionId,
      sessionDate: row.sessionDate,
      routineId: row.routineId,
      routineName: row.routineName,
    }));
  }
}
