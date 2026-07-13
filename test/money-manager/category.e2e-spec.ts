import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createAuthenticatedUser, createTestApp } from '../utils/test-app';

describe('Category (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const movementType = 'MT01';
  const icon = 'pricetag-outline';
  const createdIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ token, userId } = await createAuthenticatedUser(app));
  });

  afterAll(async () => {
    await prisma.category.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  it('creates a category tied to a movement type', async () => {
    const res = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Groceries-${Date.now()}`, icon, movementType })
      .expect(201);

    createdIds.push(res.body.data.id);

    const listRes = await request(app.getHttpServer())
      .get('/categories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const created = listRes.body.data.find(
      (c: { id: string }) => c.id === res.body.data.id,
    );
    expect(created.icon).toBe(icon);
  });

  it('🔍 rejects a missing icon', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `NoIcon-${Date.now()}`, movementType })
      .expect(400);
  });

  it('rejects an invalid movementType', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Ghost-${Date.now()}`,
        movementType: 'NotARealType',
      })
      .expect(400);
  });

  it('rejects the old label as an invalid movementType code', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Ghost-${Date.now()}`,
        movementType: 'Gasto',
      })
      .expect(400);
  });

  it('returns movementTypeLabel alongside the movementType code', async () => {
    const res = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Labeled-${Date.now()}`, icon, movementType })
      .expect(201);
    createdIds.push(res.body.data.id);

    const listRes = await request(app.getHttpServer())
      .get('/categories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const created = listRes.body.data.find(
      (c: { id: string }) => c.id === res.body.data.id,
    );
    expect(created.movementType).toBe('MT01');
    expect(created.movementTypeLabel).toBe('Gasto');
  });

  it('rejects a duplicate name within the same movement type', async () => {
    const name = `Duplicate-${Date.now()}`;
    const first = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, icon, movementType })
      .expect(201);
    createdIds.push(first.body.data.id);

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, icon, movementType })
      .expect(409);
  });

  it('🔍 enforces the same movementType validation check on update', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `ToUpdate-${Date.now()}`, icon, movementType })
      .expect(201);
    createdIds.push(createRes.body.data.id);

    await request(app.getHttpServer())
      .patch(`/categories/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ movementType: 'NotARealType' })
      .expect(400);
  });

  it('🔍 blocks deleting a category referenced by a movement', async () => {
    const account = await prisma.account.create({
      data: { name: `Temp-${Date.now()}`, type: 'AT02', userId },
    });
    const categoryRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Referenced-${Date.now()}`, icon, movementType })
      .expect(201);
    const categoryId = categoryRes.body.data.id;
    createdIds.push(categoryId);

    const movement = await prisma.movement.create({
      data: {
        amount: '1.00',
        date: new Date(),
        accountId: account.id,
        categoryId,
        movementType,
        userId,
      },
    });

    await request(app.getHttpServer())
      .delete(`/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await prisma.movement.delete({ where: { id: movement.id } });
    await prisma.account.delete({ where: { id: account.id } });
    await request(app.getHttpServer())
      .delete(`/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    createdIds.splice(createdIds.indexOf(categoryId), 1);
  });

  it("🔍 a second user can create the same name/movementType pair without conflict, and cannot touch the first user's category", async () => {
    const name = `Shared-${Date.now()}`;
    const createRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, icon, movementType })
      .expect(201);
    createdIds.push(createRes.body.data.id);

    const { token: otherToken } = await createAuthenticatedUser(app);

    const otherCreateRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name, icon, movementType })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/categories/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Hijacked' })
      .expect(404);

    await prisma.category.delete({
      where: { id: otherCreateRes.body.data.id },
    });
  });

  it('🔍 a global category (userId: null) is visible to every user but cannot be updated or deleted by any of them', async () => {
    const global = await prisma.category.create({
      data: {
        name: `Global-${Date.now()}`,
        icon,
        movementType,
        userId: null,
      },
    });

    const listRes = await request(app.getHttpServer())
      .get('/categories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const found = listRes.body.data.find(
      (c: { id: string }) => c.id === global.id,
    );
    expect(found).toBeDefined();
    expect(found.isCustom).toBe(false);

    await request(app.getHttpServer())
      .patch(`/categories/${global.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/categories/${global.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    await prisma.category.delete({ where: { id: global.id } });
  });
});
