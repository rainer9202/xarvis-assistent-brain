import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import { GetWorkoutSessionStatsUseCase } from './get-workout-session-stats.use-case';

describe('GetWorkoutSessionStatsUseCase', () => {
  let findAllForStats: jest.Mock;
  let repository: WorkoutSessionRepositoryPort;
  let useCase: GetWorkoutSessionStatsUseCase;

  beforeEach(() => {
    findAllForStats = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithExercises: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countByUserId: jest.fn(),
      findAllForStats,
    };
    useCase = new GetWorkoutSessionStatsUseCase(repository);
  });

  it('returns all-zero stats for a user with no sessions (spec: no 404, zeroed fields)', async () => {
    findAllForStats.mockResolvedValue([]);

    const result = await useCase.execute('user-1');

    expect(result).toEqual({
      totalCount: 0,
      countThisMonth: 0,
      currentStreak: 0,
      avgDurationMinutes: 0,
    });
  });

  it('reports currentStreak: 3 when the 3 most recent sessions are all finished (spec scenario: active streak)', async () => {
    findAllForStats.mockResolvedValue([
      {
        date: new Date('2024-03-03T00:00:00Z'),
        finishedAt: new Date('2024-03-03T01:00:00Z'),
      },
      {
        date: new Date('2024-03-02T00:00:00Z'),
        finishedAt: new Date('2024-03-02T01:00:00Z'),
      },
      {
        date: new Date('2024-03-01T00:00:00Z'),
        finishedAt: new Date('2024-03-01T01:00:00Z'),
      },
    ]);

    const result = await useCase.execute('user-1');

    expect(result.currentStreak).toBe(3);
  });

  it('stops the streak count at the first unfinished session walking newest-to-oldest', async () => {
    findAllForStats.mockResolvedValue([
      {
        date: new Date('2024-03-05T00:00:00Z'),
        finishedAt: new Date('2024-03-05T01:00:00Z'),
      },
      { date: new Date('2024-03-04T00:00:00Z'), finishedAt: null },
      {
        date: new Date('2024-03-03T00:00:00Z'),
        finishedAt: new Date('2024-03-03T01:00:00Z'),
      },
    ]);

    const result = await useCase.execute('user-1');

    expect(result.currentStreak).toBe(1);
  });

  it('counts totalCount as the full row count regardless of finished/unfinished state', async () => {
    findAllForStats.mockResolvedValue([
      { date: new Date('2024-03-05T00:00:00Z'), finishedAt: null },
      { date: new Date('2024-03-04T00:00:00Z'), finishedAt: null },
    ]);

    const result = await useCase.execute('user-1');

    expect(result.totalCount).toBe(2);
  });

  it('counts countThisMonth only for sessions whose date falls in the current UTC calendar month', async () => {
    const now = new Date();
    const thisMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15),
    );
    const lastMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15),
    );
    findAllForStats.mockResolvedValue([
      { date: thisMonth, finishedAt: null },
      { date: lastMonth, finishedAt: null },
    ]);

    const result = await useCase.execute('user-1');

    expect(result.countThisMonth).toBe(1);
  });

  it('computes avgDurationMinutes only over finished sessions, using finishedAt - date', async () => {
    findAllForStats.mockResolvedValue([
      {
        date: new Date('2024-03-01T00:00:00Z'),
        finishedAt: new Date('2024-03-01T01:00:00Z'), // 60 min
      },
      {
        date: new Date('2024-03-02T00:00:00Z'),
        finishedAt: new Date('2024-03-02T00:30:00Z'), // 30 min
      },
      // unfinished session must not skew the average
      { date: new Date('2024-03-03T00:00:00Z'), finishedAt: null },
    ]);

    const result = await useCase.execute('user-1');

    expect(result.avgDurationMinutes).toBe(45);
  });

  it('returns avgDurationMinutes: 0 when there are sessions but none are finished', async () => {
    findAllForStats.mockResolvedValue([
      { date: new Date('2024-03-01T00:00:00Z'), finishedAt: null },
    ]);

    const result = await useCase.execute('user-1');

    expect(result.avgDurationMinutes).toBe(0);
  });
});
