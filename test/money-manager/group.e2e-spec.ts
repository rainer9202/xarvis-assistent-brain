import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createAuthenticatedUser, createTestApp } from '../utils/test-app';

describe('Group (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ token } = await createAuthenticatedUser(app));
  });

  afterAll(async () => {
    await prisma.group.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  it('creates a group and lists it', async () => {
    const res = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `FixedExpenses-${Date.now()}` })
      .expect(201);
    createdIds.push(res.body.data.id);

    const listRes = await request(app.getHttpServer())
      .get('/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const created = listRes.body.data.find(
      (g: { id: string }) => g.id === res.body.data.id,
    );
    expect(created.isActive).toBe(true);
  });

  it('rejects a duplicate name', async () => {
    const name = `Duplicate-${Date.now()}`;
    const first = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name })
      .expect(201);
    createdIds.push(first.body.data.id);

    await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name })
      .expect(409);
  });

  it('updates a group', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `ToUpdate-${Date.now()}` })
      .expect(201);
    createdIds.push(createRes.body.data.id);

    await request(app.getHttpServer())
      .patch(`/groups/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed', isActive: false })
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get('/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const updated = listRes.body.data.find(
      (g: { id: string }) => g.id === createRes.body.data.id,
    );
    expect(updated.name).toBe('Renamed');
    expect(updated.isActive).toBe(false);
  });

  it('deletes a group', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `ToDelete-${Date.now()}` })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/groups/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('returns 404 for a nonexistent group id', async () => {
    await request(app.getHttpServer())
      .patch('/groups/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Whatever' })
      .expect(404);
  });

  it("🔍 a second user cannot touch the first user's group", async () => {
    const createRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Owned-${Date.now()}` })
      .expect(201);
    createdIds.push(createRes.body.data.id);

    const { token: otherToken } = await createAuthenticatedUser(app);

    await request(app.getHttpServer())
      .patch(`/groups/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/groups/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });
});
