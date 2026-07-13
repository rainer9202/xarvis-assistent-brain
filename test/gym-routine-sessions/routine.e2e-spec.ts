import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createAuthenticatedUser, createTestApp } from '../utils/test-app';

describe('Routine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let exerciseId: string;
  const routineIds: string[] = [];
  const exerciseIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ token } = await createAuthenticatedUser(app));

    const exerciseRes = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Routine Test Exercise-${Date.now()}` })
      .expect(201);
    exerciseId = exerciseRes.body.data.id;
    exerciseIds.push(exerciseId);
  });

  afterAll(async () => {
    await prisma.workoutSession.deleteMany({
      where: { routineId: { in: routineIds } },
    });
    await prisma.routine.deleteMany({ where: { id: { in: routineIds } } });
    await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
    await app.close();
  });

  const validExercisePayload = () => ({
    exerciseId,
    targetSets: 4,
    targetReps: 10,
    targetWeightGrams: 20000,
  });

  it('creates a routine with exercises and lists it with exerciseCount', async () => {
    const res = await request(app.getHttpServer())
      .post('/routines')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Pecho-${Date.now()}`,
        exercises: [validExercisePayload()],
      })
      .expect(201);
    routineIds.push(res.body.data.id);

    const listRes = await request(app.getHttpServer())
      .get('/routines')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const created = listRes.body.data.find(
      (r: { id: string }) => r.id === res.body.data.id,
    );
    expect(created.exerciseCount).toBe(1);
    expect(created.isActive).toBe(true);
  });

  it('gets a routine by id with exercise details (name resolved)', async () => {
    const res = await request(app.getHttpServer())
      .post('/routines')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Espalda-${Date.now()}`,
        exercises: [validExercisePayload()],
      })
      .expect(201);
    routineIds.push(res.body.data.id);

    const getRes = await request(app.getHttpServer())
      .get(`/routines/${res.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(getRes.body.data.exercises).toHaveLength(1);
    expect(getRes.body.data.exercises[0]).toMatchObject({
      exerciseId,
      targetSets: 4,
      targetReps: 10,
      targetWeightGrams: 20000,
    });
    expect(getRes.body.data.exercises[0].exerciseName).toEqual(
      expect.any(String),
    );
  });

  it('rejects a duplicate routine name for the same user', async () => {
    const name = `Duplicate-${Date.now()}`;
    const first = await request(app.getHttpServer())
      .post('/routines')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, exercises: [validExercisePayload()] })
      .expect(201);
    routineIds.push(first.body.data.id);

    await request(app.getHttpServer())
      .post('/routines')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, exercises: [validExercisePayload()] })
      .expect(409);
  });

  it('rejects a routine referencing a nonexistent exerciseId', async () => {
    await request(app.getHttpServer())
      .post('/routines')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `BadExercise-${Date.now()}`,
        exercises: [
          {
            exerciseId: '00000000-0000-0000-0000-000000000000',
            targetSets: 4,
            targetReps: 10,
            targetWeightGrams: 20000,
          },
        ],
      })
      .expect(404);
  });

  it('rejects invalid bounds (targetSets: 0) at the DTO layer', async () => {
    await request(app.getHttpServer())
      .post('/routines')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `BadBounds-${Date.now()}`,
        exercises: [{ ...validExercisePayload(), targetSets: 0 }],
      })
      .expect(400);
  });

  it('updates a routine, replacing its exercise list', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/routines')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `ToUpdate-${Date.now()}`,
        exercises: [validExercisePayload()],
      })
      .expect(201);
    routineIds.push(createRes.body.data.id);

    await request(app.getHttpServer())
      .patch(`/routines/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Routine', exercises: [] })
      .expect(200);

    const getRes = await request(app.getHttpServer())
      .get(`/routines/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(getRes.body.data.name).toBe('Renamed Routine');
    expect(getRes.body.data.exercises).toHaveLength(0);
  });

  it('deletes a routine with no referencing workout sessions', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/routines')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `ToDelete-${Date.now()}`,
        exercises: [validExercisePayload()],
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/routines/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it("🔍 a second user cannot touch the first user's routine", async () => {
    const createRes = await request(app.getHttpServer())
      .post('/routines')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Owned-${Date.now()}`,
        exercises: [validExercisePayload()],
      })
      .expect(201);
    routineIds.push(createRes.body.data.id);

    const { token: otherToken } = await createAuthenticatedUser(app);

    await request(app.getHttpServer())
      .patch(`/routines/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/routines/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });
});
