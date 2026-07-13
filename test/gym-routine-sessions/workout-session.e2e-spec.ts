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
});
