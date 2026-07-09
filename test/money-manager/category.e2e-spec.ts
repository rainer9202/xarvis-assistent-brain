import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createAuthenticatedUser, createTestApp } from '../utils/test-app';

describe('Category (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let movementTypeId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ token, userId } = await createAuthenticatedUser(app));
    const movementType = await prisma.movementType.findFirstOrThrow({
      where: { name: 'expense' },
    });
    movementTypeId = movementType.id;
  });

  afterAll(async () => {
    await prisma.category.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  it('creates a category tied to a movement type', async () => {
    const res = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Groceries-${Date.now()}`, movementTypeId })
      .expect(201);

    createdIds.push(res.body.data.id);
  });

  it('rejects a nonexistent movementTypeId', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Ghost-${Date.now()}`,
        movementTypeId: '00000000-0000-0000-0000-000000000000',
      })
      .expect(404);
  });

  it('rejects a duplicate name within the same movement type', async () => {
    const name = `Duplicate-${Date.now()}`;
    const first = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, movementTypeId })
      .expect(201);
    createdIds.push(first.body.data.id);

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, movementTypeId })
      .expect(409);
  });

  it('🔍 enforces the same movementTypeId existence check on update', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `ToUpdate-${Date.now()}`, movementTypeId })
      .expect(201);
    createdIds.push(createRes.body.data.id);

    await request(app.getHttpServer())
      .patch(`/categories/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ movementTypeId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });

  it('🔍 blocks deleting a category referenced by a movement', async () => {
    const account = await prisma.account.create({
      data: { name: `Temp-${Date.now()}`, type: 'bank', userId },
    });
    const categoryRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Referenced-${Date.now()}`, movementTypeId })
      .expect(201);
    const categoryId = categoryRes.body.data.id;
    createdIds.push(categoryId);

    const movement = await prisma.movement.create({
      data: {
        amount: '1.00',
        date: new Date(),
        accountId: account.id,
        categoryId,
        movementTypeId,
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
      .send({ name, movementTypeId })
      .expect(201);
    createdIds.push(createRes.body.data.id);

    const { token: otherToken } = await createAuthenticatedUser(app);

    const otherCreateRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name, movementTypeId })
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
});
