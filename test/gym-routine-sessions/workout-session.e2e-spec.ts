import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createAuthenticatedUser, createTestApp } from '../utils/test-app';

describe('WorkoutSession (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let exerciseId: string;
  let routineId: string;
  const sessionIds: string[] = [];
  const routineIds: string[] = [];
  const exerciseIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ token } = await createAuthenticatedUser(app));

    const exerciseRes = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Session Test Exercise-${Date.now()}` })
      .expect(201);
    exerciseId = exerciseRes.body.data.id;
    exerciseIds.push(exerciseId);

    const routineRes = await request(app.getHttpServer())
      .post('/routines')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Session Test Routine-${Date.now()}`,
        exercises: [
          {
            exerciseId,
            targetSets: 4,
            targetReps: 10,
            targetWeightGrams: 20000,
          },
        ],
      })
      .expect(201);
    routineId = routineRes.body.data.id;
    routineIds.push(routineId);
  });

  afterAll(async () => {
    await prisma.workoutSessionExercise.deleteMany({
      where: { workoutSessionId: { in: sessionIds } },
    });
    await prisma.workoutSession.deleteMany({
      where: { id: { in: sessionIds } },
    });
    await prisma.routine.deleteMany({ where: { id: { in: routineIds } } });
    await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
    await app.close();
  });

  it('runs the full happy path: create session, log actual performance (fewer kg than planned), finish, and read it back', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/workout-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ routineId, date: new Date().toISOString() })
      .expect(201);
    const sessionId = createRes.body.data.id;
    sessionIds.push(sessionId);

    // Planned: 4 sets / 10 reps / 20000g (20kg). Actual: fewer kg lifted.
    const logRes = await request(app.getHttpServer())
      .post('/workout-session-exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workoutSessionId: sessionId,
        exerciseId,
        actualSets: 4,
        actualReps: 10,
        actualWeightGrams: 17500,
      })
      .expect(201);
    const logId = logRes.body.data.id;

    await request(app.getHttpServer())
      .patch(`/workout-sessions/${sessionId}/finish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const getRes = await request(app.getHttpServer())
      .get(`/workout-sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getRes.body.data.finishedAt).not.toBeNull();
    expect(getRes.body.data.routineName).toEqual(expect.any(String));
    expect(getRes.body.data.exercises).toHaveLength(1);
    expect(getRes.body.data.exercises[0]).toMatchObject({
      id: logId,
      exerciseId,
      actualSets: 4,
      actualReps: 10,
      actualWeightGrams: 17500,
    });
  });

  it('rejects finishing an already-finished session', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/workout-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ routineId, date: new Date().toISOString() })
      .expect(201);
    sessionIds.push(createRes.body.data.id);

    await request(app.getHttpServer())
      .patch(`/workout-sessions/${createRes.body.data.id}/finish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/workout-sessions/${createRes.body.data.id}/finish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('blocks logging a new exercise on a finished session but allows updating an existing entry', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/workout-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ routineId, date: new Date().toISOString() })
      .expect(201);
    const sessionId = createRes.body.data.id;
    sessionIds.push(sessionId);

    const logRes = await request(app.getHttpServer())
      .post('/workout-session-exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workoutSessionId: sessionId,
        exerciseId,
        actualSets: 3,
        actualReps: 12,
        actualWeightGrams: 15000,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/workout-sessions/${sessionId}/finish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // New log entry rejected on a finished session.
    await request(app.getHttpServer())
      .post('/workout-session-exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workoutSessionId: sessionId,
        exerciseId,
        actualSets: 3,
        actualReps: 12,
        actualWeightGrams: 15000,
      })
      .expect(400);

    // Correcting an existing entry is still allowed post-finish.
    await request(app.getHttpServer())
      .patch(`/workout-session-exercises/${logRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actualWeightGrams: 16000 })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/workout-session-exercises/${logRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('deletes a workout session (children cascade)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/workout-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ routineId, date: new Date().toISOString() })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/workout-sessions/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  describe('GET /workout-sessions (loggedExerciseCount / totalExerciseCount)', () => {
    it('reports loggedExerciseCount and totalExerciseCount for a partially logged session (spec scenario 1)', async () => {
      const secondExerciseRes = await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Session Count Exercise B-${Date.now()}` })
        .expect(201);
      const secondExerciseId = secondExerciseRes.body.data.id as string;
      exerciseIds.push(secondExerciseId);

      const thirdExerciseRes = await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Session Count Exercise C-${Date.now()}` })
        .expect(201);
      const thirdExerciseId = thirdExerciseRes.body.data.id as string;
      exerciseIds.push(thirdExerciseId);

      const fourthExerciseRes = await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Session Count Exercise D-${Date.now()}` })
        .expect(201);
      const fourthExerciseId = fourthExerciseRes.body.data.id as string;
      exerciseIds.push(fourthExerciseId);

      // Routine with 4 exercises.
      const routineRes = await request(app.getHttpServer())
        .post('/routines')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Session Count Routine-${Date.now()}`,
          exercises: [
            {
              exerciseId,
              targetSets: 4,
              targetReps: 10,
              targetWeightGrams: 20000,
            },
            {
              exerciseId: secondExerciseId,
              targetSets: 4,
              targetReps: 10,
              targetWeightGrams: 20000,
            },
            {
              exerciseId: thirdExerciseId,
              targetSets: 4,
              targetReps: 10,
              targetWeightGrams: 20000,
            },
            {
              exerciseId: fourthExerciseId,
              targetSets: 4,
              targetReps: 10,
              targetWeightGrams: 20000,
            },
          ],
        })
        .expect(201);
      const countRoutineId = routineRes.body.data.id as string;
      routineIds.push(countRoutineId);

      const createRes = await request(app.getHttpServer())
        .post('/workout-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ routineId: countRoutineId, date: new Date().toISOString() })
        .expect(201);
      const sessionId = createRes.body.data.id as string;
      sessionIds.push(sessionId);

      // Log 2 of the 4 planned exercises.
      await request(app.getHttpServer())
        .post('/workout-session-exercises')
        .set('Authorization', `Bearer ${token}`)
        .send({
          workoutSessionId: sessionId,
          exerciseId,
          actualSets: 4,
          actualReps: 10,
          actualWeightGrams: 20000,
        })
        .expect(201);
      await request(app.getHttpServer())
        .post('/workout-session-exercises')
        .set('Authorization', `Bearer ${token}`)
        .send({
          workoutSessionId: sessionId,
          exerciseId: secondExerciseId,
          actualSets: 4,
          actualReps: 10,
          actualWeightGrams: 20000,
        })
        .expect(201);

      const listRes = await request(app.getHttpServer())
        .get('/workout-sessions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const item = (
        listRes.body.data as Array<{
          id: string;
          routineId: string;
          routineName: string;
          date: string;
          finishedAt: string | null;
          createdAt: string;
          loggedExerciseCount: number;
          totalExerciseCount: number;
        }>
      ).find((i) => i.id === sessionId);

      expect(item).toBeDefined();
      expect(item?.loggedExerciseCount).toBe(2);
      expect(item?.totalExerciseCount).toBe(4);
      expect(item).toMatchObject({
        id: sessionId,
        routineId: countRoutineId,
        routineName: expect.any(String),
        date: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it('reports loggedExerciseCount: 0 for a session with nothing logged yet, against a routine with 5 exercises (spec scenario 2)', async () => {
      const exerciseIdsForRoutine: string[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .post('/exercises')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: `No-Logged Exercise ${i}-${Date.now()}` })
          .expect(201);
        const id = res.body.data.id as string;
        exerciseIdsForRoutine.push(id);
        exerciseIds.push(id);
      }

      const routineRes = await request(app.getHttpServer())
        .post('/routines')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `No-Logged Routine-${Date.now()}`,
          exercises: exerciseIdsForRoutine.map((id) => ({
            exerciseId: id,
            targetSets: 3,
            targetReps: 8,
            targetWeightGrams: 10000,
          })),
        })
        .expect(201);
      const noLoggedRoutineId = routineRes.body.data.id as string;
      routineIds.push(noLoggedRoutineId);

      const createRes = await request(app.getHttpServer())
        .post('/workout-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ routineId: noLoggedRoutineId, date: new Date().toISOString() })
        .expect(201);
      const sessionId = createRes.body.data.id as string;
      sessionIds.push(sessionId);

      const listRes = await request(app.getHttpServer())
        .get('/workout-sessions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const item = (
        listRes.body.data as Array<{
          id: string;
          loggedExerciseCount: number;
          totalExerciseCount: number;
        }>
      ).find((i) => i.id === sessionId);

      expect(item).toBeDefined();
      expect(item?.loggedExerciseCount).toBe(0);
      expect(item?.totalExerciseCount).toBe(5);
    });

    it('does not clamp loggedExerciseCount when it exceeds the routine current count after a full-replace edit (spec scenario 3 / ADR-2)', async () => {
      const sixExerciseIds: string[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await request(app.getHttpServer())
          .post('/exercises')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: `Trim Exercise ${i}-${Date.now()}` })
          .expect(201);
        const id = res.body.data.id as string;
        sixExerciseIds.push(id);
        exerciseIds.push(id);
      }

      // Routine starts with 6 exercises.
      const routineRes = await request(app.getHttpServer())
        .post('/routines')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Trim Routine-${Date.now()}`,
          exercises: sixExerciseIds.map((id) => ({
            exerciseId: id,
            targetSets: 3,
            targetReps: 8,
            targetWeightGrams: 10000,
          })),
        })
        .expect(201);
      const trimRoutineId = routineRes.body.data.id as string;
      routineIds.push(trimRoutineId);

      const createRes = await request(app.getHttpServer())
        .post('/workout-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ routineId: trimRoutineId, date: new Date().toISOString() })
        .expect(201);
      const sessionId = createRes.body.data.id as string;
      sessionIds.push(sessionId);

      // Log all 6 exercises while the routine still has 6.
      for (const id of sixExerciseIds) {
        await request(app.getHttpServer())
          .post('/workout-session-exercises')
          .set('Authorization', `Bearer ${token}`)
          .send({
            workoutSessionId: sessionId,
            exerciseId: id,
            actualSets: 3,
            actualReps: 8,
            actualWeightGrams: 10000,
          })
          .expect(201);
      }

      // Full-replace-edit the routine down to 3 exercises.
      await request(app.getHttpServer())
        .patch(`/routines/${trimRoutineId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          exercises: sixExerciseIds.slice(0, 3).map((id) => ({
            exerciseId: id,
            targetSets: 3,
            targetReps: 8,
            targetWeightGrams: 10000,
          })),
        })
        .expect(200);

      const listRes = await request(app.getHttpServer())
        .get('/workout-sessions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const item = (
        listRes.body.data as Array<{
          id: string;
          loggedExerciseCount: number;
          totalExerciseCount: number;
        }>
      ).find((i) => i.id === sessionId);

      expect(item).toBeDefined();
      expect(item?.loggedExerciseCount).toBe(6);
      expect(item?.totalExerciseCount).toBe(3);
    });
  });

  it("🔍 a second user cannot touch the first user's workout session", async () => {
    const createRes = await request(app.getHttpServer())
      .post('/workout-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ routineId, date: new Date().toISOString() })
      .expect(201);
    sessionIds.push(createRes.body.data.id);

    const { token: otherToken } = await createAuthenticatedUser(app);

    await request(app.getHttpServer())
      .patch(`/workout-sessions/${createRes.body.data.id}/finish`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/workout-sessions/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  describe('GET /workout-sessions/exercises/:exerciseId/progress', () => {
    it('returns logged entries ordered by sessionDate ascending, with all six fields, resolved without a per-session query (spec scenario "Exercise logged across multiple sessions")', async () => {
      const progressExerciseRes = await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Progress Exercise-${Date.now()}` })
        .expect(201);
      const progressExerciseId = progressExerciseRes.body.data.id as string;
      exerciseIds.push(progressExerciseId);

      const progressRoutineRes = await request(app.getHttpServer())
        .post('/routines')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Progress Routine-${Date.now()}`,
          exercises: [
            {
              exerciseId: progressExerciseId,
              targetSets: 4,
              targetReps: 10,
              targetWeightGrams: 20000,
            },
          ],
        })
        .expect(201);
      const progressRoutineId = progressRoutineRes.body.data.id as string;
      routineIds.push(progressRoutineId);

      const olderSessionRes = await request(app.getHttpServer())
        .post('/workout-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          routineId: progressRoutineId,
          date: new Date('2024-01-01T00:00:00Z').toISOString(),
        })
        .expect(201);
      const olderSessionId = olderSessionRes.body.data.id as string;
      sessionIds.push(olderSessionId);

      const newerSessionRes = await request(app.getHttpServer())
        .post('/workout-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          routineId: progressRoutineId,
          date: new Date('2024-03-01T00:00:00Z').toISOString(),
        })
        .expect(201);
      const newerSessionId = newerSessionRes.body.data.id as string;
      sessionIds.push(newerSessionId);

      const newestSessionRes = await request(app.getHttpServer())
        .post('/workout-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          routineId: progressRoutineId,
          date: new Date('2024-06-01T00:00:00Z').toISOString(),
        })
        .expect(201);
      const newestSessionId = newestSessionRes.body.data.id as string;
      sessionIds.push(newestSessionId);

      await request(app.getHttpServer())
        .post('/workout-session-exercises')
        .set('Authorization', `Bearer ${token}`)
        .send({
          workoutSessionId: newerSessionId,
          exerciseId: progressExerciseId,
          actualSets: 4,
          actualReps: 10,
          actualWeightGrams: 20000,
        })
        .expect(201);
      await request(app.getHttpServer())
        .post('/workout-session-exercises')
        .set('Authorization', `Bearer ${token}`)
        .send({
          workoutSessionId: olderSessionId,
          exerciseId: progressExerciseId,
          actualSets: 3,
          actualReps: 12,
          actualWeightGrams: 15000,
        })
        .expect(201);
      await request(app.getHttpServer())
        .post('/workout-session-exercises')
        .set('Authorization', `Bearer ${token}`)
        .send({
          workoutSessionId: newestSessionId,
          exerciseId: progressExerciseId,
          actualSets: 5,
          actualReps: 8,
          actualWeightGrams: 22500,
        })
        .expect(201);

      const progressRes = await request(app.getHttpServer())
        .get(`/workout-sessions/exercises/${progressExerciseId}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(progressRes.body.data).toHaveLength(3);
      expect(
        (progressRes.body.data as Array<{ sessionId: string }>).map(
          (item) => item.sessionId,
        ),
      ).toEqual([olderSessionId, newerSessionId, newestSessionId]);
      expect(progressRes.body.data[0]).toMatchObject({
        sessionId: olderSessionId,
        routineId: progressRoutineId,
        routineName: expect.any(String),
        actualSets: 3,
        actualReps: 12,
        actualWeightGrams: 15000,
      });
    });

    it('returns 200 with an empty array for a visible exercise that was never logged (spec scenario "Exercise visible but never logged")', async () => {
      const neverLoggedRes = await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Never Logged Exercise-${Date.now()}` })
        .expect(201);
      const neverLoggedExerciseId = neverLoggedRes.body.data.id as string;
      exerciseIds.push(neverLoggedExerciseId);

      const progressRes = await request(app.getHttpServer())
        .get(`/workout-sessions/exercises/${neverLoggedExerciseId}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(progressRes.body.data).toEqual([]);
    });

    it('returns 404 for a nonexistent exerciseId (spec scenario "Exercise does not exist")', async () => {
      await request(app.getHttpServer())
        .get(
          '/workout-sessions/exercises/00000000-0000-0000-0000-000000000000/progress',
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it("returns 404 for another user's custom exerciseId, indistinguishable from the nonexistent-id case (spec scenario \"Exercise belongs to another user's custom exercise\")", async () => {
      const { token: otherToken } = await createAuthenticatedUser(app);

      const otherExerciseRes = await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ name: `Other User Exercise-${Date.now()}` })
        .expect(201);
      const otherExerciseId = otherExerciseRes.body.data.id as string;
      exerciseIds.push(otherExerciseId);

      const nonexistentRes = await request(app.getHttpServer())
        .get(
          '/workout-sessions/exercises/00000000-0000-0000-0000-000000000000/progress',
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      const otherOwnedRes = await request(app.getHttpServer())
        .get(`/workout-sessions/exercises/${otherExerciseId}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(Object.keys(otherOwnedRes.body).sort()).toEqual(
        Object.keys(nonexistentRes.body).sort(),
      );
      expect(otherOwnedRes.body.statusCode).toEqual(
        nonexistentRes.body.statusCode,
      );
    });
  });
});
