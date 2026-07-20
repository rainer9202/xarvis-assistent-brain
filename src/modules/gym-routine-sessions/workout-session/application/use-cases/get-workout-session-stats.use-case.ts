import { Inject, Injectable } from '@nestjs/common';
import { WORKOUT_SESSION_REPOSITORY } from '../../domain/ports/workout-session.repository.port';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';

export type GetWorkoutSessionStatsResponse = {
  totalCount: number;
  countThisMonth: number;
  currentStreak: number;
  avgDurationMinutes: number;
};

@Injectable()
export class GetWorkoutSessionStatsUseCase {
  constructor(
    @Inject(WORKOUT_SESSION_REPOSITORY)
    private readonly repository: WorkoutSessionRepositoryPort,
  ) {}

  async execute(userId: string): Promise<GetWorkoutSessionStatsResponse> {
    // Repository contract: rows come back ordered by date DESC (most recent
    // first) — both the streak walk and the "this month" filter below rely
    // on that single fetch, no second query.
    const rows = await this.repository.findAllForStats(userId);

    const totalCount = rows.length;

    const now = new Date();
    const countThisMonth = rows.filter(
      (row) =>
        row.date.getUTCFullYear() === now.getUTCFullYear() &&
        row.date.getUTCMonth() === now.getUTCMonth(),
    ).length;

    // Consecutive finished sessions counting back from the most recent one
    // (rows[0]) — mirrors the frontend's lib/session-stats.ts criterion:
    // walk newest-to-oldest, stop counting at the first unfinished session
    // (finishedAt == null) or when history runs out.
    let currentStreak = 0;
    for (const row of rows) {
      if (row.finishedAt == null) break;
      currentStreak += 1;
    }

    // Duration is only meaningful for sessions that actually finished — the
    // start is `date`, the end is `finishedAt`, both persisted by
    // create-workout-session/finish-workout-session use cases.
    const durationsMinutes = rows
      .filter(
        (row): row is { date: Date; finishedAt: Date } =>
          row.finishedAt != null,
      )
      .map((row) => (row.finishedAt.getTime() - row.date.getTime()) / 60_000);

    const avgDurationMinutes =
      durationsMinutes.length === 0
        ? 0
        : Math.round(
            durationsMinutes.reduce((sum, minutes) => sum + minutes, 0) /
              durationsMinutes.length,
          );

    return { totalCount, countThisMonth, currentStreak, avgDurationMinutes };
  }
}
