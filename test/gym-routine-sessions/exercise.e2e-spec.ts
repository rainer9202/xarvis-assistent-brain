import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createAuthenticatedUser, createTestApp } from '../utils/test-app';

describe('Exercise (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ token } = await createAuthenticatedUser(app));
  });

  afterAll(async () => {
    await prisma.exercise.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  it('creates a custom exercise and lists it as isCustom: true', async () => {
    const res = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Custom Curl-${Date.now()}`, category: 'upper arms' })
      .expect(201);
    createdIds.push(res.body.data.id);

    const listRes = await request(app.getHttpServer())
      .get('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const created = listRes.body.data.find(
      (e: { id: string }) => e.id === res.body.data.id,
    );
    expect(created.isCustom).toBe(true);
  });

  it('gets a single exercise by id', async () => {
    const res = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Custom Press-${Date.now()}` })
      .expect(201);
    createdIds.push(res.body.data.id);

    const getRes = await request(app.getHttpServer())
      .get(`/exercises/${res.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(getRes.body.data.id).toBe(res.body.data.id);
    expect(getRes.body.data.isCustom).toBe(true);
  });

  it('updates an owned exercise', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `ToUpdate-${Date.now()}` })
      .expect(201);
    createdIds.push(createRes.body.data.id);

    await request(app.getHttpServer())
      .patch(`/exercises/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Exercise' })
      .expect(200);

    const getRes = await request(app.getHttpServer())
      .get(`/exercises/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(getRes.body.data.name).toBe('Renamed Exercise');
  });

  it('deletes an owned exercise with no references', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `ToDelete-${Date.now()}` })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/exercises/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('returns 404 for a nonexistent exercise id', async () => {
    await request(app.getHttpServer())
      .patch('/exercises/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Whatever' })
      .expect(404);
  });

  it("🔍 a second user cannot touch the first user's exercise", async () => {
    const createRes = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Owned-${Date.now()}` })
      .expect(201);
    createdIds.push(createRes.body.data.id);

    const { token: otherToken } = await createAuthenticatedUser(app);

    await request(app.getHttpServer())
      .patch(`/exercises/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/exercises/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('a global (seeded) exercise is visible to read but rejects write attempts as 404', async () => {
    const global = await prisma.exercise.create({
      data: { userId: null, name: `Global-${Date.now()}` },
    });

    const getRes = await request(app.getHttpServer())
      .get(`/exercises/${global.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(getRes.body.data.isCustom).toBe(false);

    await request(app.getHttpServer())
      .patch(`/exercises/${global.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hijacked global' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/exercises/${global.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    await prisma.exercise.delete({ where: { id: global.id } });
  });
});
