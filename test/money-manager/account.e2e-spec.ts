import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createAuthenticatedUser, createTestApp } from '../utils/test-app';

describe('Account (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ cookie } = await createAuthenticatedUser(app));
  });

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  it('creates an account with balanceCents starting at 0', async () => {
    const res = await request(app.getHttpServer())
      .post('/accounts')
      .set('Cookie', cookie)
      .send({ name: `Checking-${Date.now()}`, type: 'bank' })
      .expect(201);

    const id = res.body.data.id;
    createdIds.push(id);

    await request(app.getHttpServer())
      .get(`/accounts/${id}`)
      .set('Cookie', cookie)
      .expect(200)
      .expect((getRes) => {
        expect(getRes.body.data.balanceCents).toBe(0);
        expect(getRes.body.data.type).toBe('bank');
      });
  });

  it('rejects an invalid account type', async () => {
    await request(app.getHttpServer())
      .post('/accounts')
      .set('Cookie', cookie)
      .send({ name: 'Invalid', type: 'crypto-wallet' })
      .expect(400);
  });

  it('updates name, type and isActive', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Cookie', cookie)
      .send({ name: `Savings-${Date.now()}`, type: 'bank' })
      .expect(201);
    const id = createRes.body.data.id;
    createdIds.push(id);

    await request(app.getHttpServer())
      .patch(`/accounts/${id}`)
      .set('Cookie', cookie)
      .send({ type: 'cash', isActive: false })
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toEqual({ id });
      });

    const account = await prisma.account.findUniqueOrThrow({ where: { id } });
    expect(account.type).toBe('cash');
    expect(account.isActive).toBe(false);
  });

  it('🔍 rejects an invalid type on update the same way as create', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Cookie', cookie)
      .send({ name: `Checking-${Date.now()}`, type: 'bank' })
      .expect(201);
    createdIds.push(createRes.body.data.id);

    await request(app.getHttpServer())
      .patch(`/accounts/${createRes.body.data.id}`)
      .set('Cookie', cookie)
      .send({ type: 'crypto-wallet' })
      .expect(400);
  });

  it('returns 404 for a nonexistent account id', async () => {
    await request(app.getHttpServer())
      .get('/accounts/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookie)
      .expect(404);
  });

  it('🔍 rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/accounts').expect(401);
  });

  it('🔍 blocks deleting an account referenced by a movement', async () => {
    const movementType = await prisma.movementType.findFirstOrThrow({
      where: { name: 'expense' },
    });
    const accountRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Cookie', cookie)
      .send({ name: `Referenced-${Date.now()}`, type: 'bank' })
      .expect(201);
    const accountId = accountRes.body.data.id;
    createdIds.push(accountId);

    const categoryRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Cookie', cookie)
      .send({ name: `Cat-${Date.now()}`, movementTypeId: movementType.id })
      .expect(201);
    const categoryId = categoryRes.body.data.id;

    const movementRes = await request(app.getHttpServer())
      .post('/movements')
      .set('Cookie', cookie)
      .send({
        amountCents: 100,
        date: new Date().toISOString(),
        accountId,
        categoryId,
        movementTypeId: movementType.id,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/accounts/${accountId}`)
      .set('Cookie', cookie)
      .expect(400);

    await prisma.movement.delete({ where: { id: movementRes.body.data.id } });
    await prisma.category.delete({ where: { id: categoryId } });
    await request(app.getHttpServer())
      .delete(`/accounts/${accountId}`)
      .set('Cookie', cookie)
      .expect(200);
    createdIds.splice(createdIds.indexOf(accountId), 1);
  });

  it("🔍 a second user cannot see, update, or delete the first user's account", async () => {
    const createRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Cookie', cookie)
      .send({ name: `Private-${Date.now()}`, type: 'bank' })
      .expect(201);
    const accountId = createRes.body.data.id;
    createdIds.push(accountId);

    const { cookie: otherCookie } = await createAuthenticatedUser(app);

    const listRes = await request(app.getHttpServer())
      .get('/accounts')
      .set('Cookie', otherCookie)
      .expect(200);
    expect(
      listRes.body.data.some((acc: { id: string }) => acc.id === accountId),
    ).toBe(false);

    await request(app.getHttpServer())
      .get(`/accounts/${accountId}`)
      .set('Cookie', otherCookie)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/accounts/${accountId}`)
      .set('Cookie', otherCookie)
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/accounts/${accountId}`)
      .set('Cookie', otherCookie)
      .expect(404);
  });
});
