import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createAuthenticatedUser, createTestApp } from '../utils/test-app';

describe('Movement (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const expenseType = 'Gasto';
  const transferType = 'Transferencia';
  let categoryId: string;
  let accountA: string;
  let accountB: string;
  const movementIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ token, userId } = await createAuthenticatedUser(app));

    const category = await prisma.category.create({
      data: {
        name: `MovementSpec-${Date.now()}`,
        movementType: expenseType,
        userId,
      },
    });
    categoryId = category.id;

    const [a, b] = await Promise.all([
      prisma.account.create({
        data: { name: `A-${Date.now()}`, type: 'AT02', userId },
      }),
      prisma.account.create({
        data: { name: `B-${Date.now()}`, type: 'AT02', userId },
      }),
    ]);
    accountA = a.id;
    accountB = b.id;
  });

  afterAll(async () => {
    await prisma.movement.deleteMany({ where: { id: { in: movementIds } } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.account.deleteMany({
      where: { id: { in: [accountA, accountB] } },
    });
    await app.close();
  });

  it('creates an expense movement and reflects it in the account balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 2500,
        date: new Date().toISOString(),
        accountId: accountA,
        categoryId,
        movementType: expenseType,
      })
      .expect(201);
    movementIds.push(res.body.data.id);

    await request(app.getHttpServer())
      .get(`/accounts/${accountA}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((getRes) => {
        expect(getRes.body.data.balanceCents).toBe(-2500);
      });
  });

  it('transfers funds between two accounts from a single movement', async () => {
    const res = await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 1000,
        date: new Date().toISOString(),
        accountId: accountA,
        toAccountId: accountB,
        categoryId,
        movementType: transferType,
      })
      .expect(201);
    movementIds.push(res.body.data.id);

    await request(app.getHttpServer())
      .get(`/movements/${res.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((getRes) => {
        expect(getRes.body.data.toAccountId).toBe(accountB);
      });

    await request(app.getHttpServer())
      .get(`/accounts/${accountB}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((getRes) => {
        expect(getRes.body.data.balanceCents).toBe(1000);
      });
  });

  it('filters GET /movements by accountId, matching both source and destination', async () => {
    const expenseRes = await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 500,
        date: new Date().toISOString(),
        accountId: accountA,
        categoryId,
        movementType: expenseType,
      })
      .expect(201);
    movementIds.push(expenseRes.body.data.id);

    const transferRes = await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 300,
        date: new Date().toISOString(),
        accountId: accountA,
        toAccountId: accountB,
        categoryId,
        movementType: transferType,
      })
      .expect(201);
    movementIds.push(transferRes.body.data.id);

    const filteredByA = await request(app.getHttpServer())
      .get('/movements')
      .query({ accountId: accountA })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const idsForA = filteredByA.body.data.map((m: { id: string }) => m.id);
    expect(idsForA).toEqual(
      expect.arrayContaining([
        expenseRes.body.data.id,
        transferRes.body.data.id,
      ]),
    );

    const filteredByB = await request(app.getHttpServer())
      .get('/movements')
      .query({ accountId: accountB })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const idsForB = filteredByB.body.data.map((m: { id: string }) => m.id);
    expect(idsForB).toEqual(expect.arrayContaining([transferRes.body.data.id]));
    expect(idsForB).not.toContain(expenseRes.body.data.id);
  });

  it('filters GET /movements by movementType and by month', async () => {
    const oldExpenseRes = await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 700,
        date: '2020-03-15T00:00:00.000Z',
        accountId: accountA,
        categoryId,
        movementType: expenseType,
      })
      .expect(201);
    movementIds.push(oldExpenseRes.body.data.id);

    const oldTransferRes = await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 400,
        date: '2020-03-20T00:00:00.000Z',
        accountId: accountA,
        toAccountId: accountB,
        categoryId,
        movementType: transferType,
      })
      .expect(201);
    movementIds.push(oldTransferRes.body.data.id);

    const byMonth = await request(app.getHttpServer())
      .get('/movements')
      .query({ month: '2020-03' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const idsByMonth = byMonth.body.data.map((m: { id: string }) => m.id);
    expect(idsByMonth).toEqual(
      expect.arrayContaining([
        oldExpenseRes.body.data.id,
        oldTransferRes.body.data.id,
      ]),
    );

    const byMonthAndType = await request(app.getHttpServer())
      .get('/movements')
      .query({ month: '2020-03', movementType: transferType })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const idsByMonthAndType = byMonthAndType.body.data.map(
      (m: { id: string }) => m.id,
    );
    expect(idsByMonthAndType).toEqual([oldTransferRes.body.data.id]);

    await request(app.getHttpServer())
      .get('/movements')
      .query({ month: '2019-01' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        const ids = res.body.data.map((m: { id: string }) => m.id);
        expect(ids).not.toContain(oldExpenseRes.body.data.id);
        expect(ids).not.toContain(oldTransferRes.body.data.id);
      });
  });

  it('🔍 rejects a malformed month query param', async () => {
    await request(app.getHttpServer())
      .get('/movements')
      .query({ month: '2020-3' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('🔍 rejects a transfer without toAccountId', async () => {
    await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 500,
        date: new Date().toISOString(),
        accountId: accountA,
        categoryId,
        movementType: transferType,
      })
      .expect(400);
  });

  it('🔍 rejects toAccountId on a non-transfer movement', async () => {
    await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 500,
        date: new Date().toISOString(),
        accountId: accountA,
        toAccountId: accountB,
        categoryId,
        movementType: expenseType,
      })
      .expect(400);
  });

  it('🔍 rejects a transfer to the same account', async () => {
    await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 500,
        date: new Date().toISOString(),
        accountId: accountA,
        toAccountId: accountA,
        categoryId,
        movementType: transferType,
      })
      .expect(400);
  });

  it('🔍 applies the same transfer-symmetry checks on update', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 300,
        date: new Date().toISOString(),
        accountId: accountA,
        categoryId,
        movementType: expenseType,
      })
      .expect(201);
    movementIds.push(createRes.body.data.id);

    await request(app.getHttpServer())
      .patch(`/movements/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ movementType: transferType })
      .expect(400);
  });

  it('rejects an invalid amountCents', async () => {
    await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 0,
        date: new Date().toISOString(),
        accountId: accountA,
        categoryId,
        movementType: expenseType,
      })
      .expect(400);
  });

  it('rejects an invalid movementType', async () => {
    await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 500,
        date: new Date().toISOString(),
        accountId: accountA,
        categoryId,
        movementType: 'NotARealType',
      })
      .expect(400);
  });

  it('deletes a movement', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 100,
        date: new Date().toISOString(),
        accountId: accountA,
        categoryId,
        movementType: expenseType,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/movements/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toEqual({ id: createRes.body.data.id });
      });
  });

  it('returns 404 for a nonexistent movement id', async () => {
    await request(app.getHttpServer())
      .get('/movements/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it("🔍 a second user cannot create a movement against the first user's account, and cannot transfer into it either", async () => {
    const { token: otherToken } = await createAuthenticatedUser(app);

    await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        amountCents: 500,
        date: new Date().toISOString(),
        accountId: accountA,
        categoryId,
        movementType: expenseType,
      })
      .expect(404);

    const otherAccountRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: `Other-${Date.now()}`, type: 'AT02' })
      .expect(201);
    const otherCategoryRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: `OtherCat-${Date.now()}`, movementType: expenseType })
      .expect(201);

    await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        amountCents: 500,
        date: new Date().toISOString(),
        accountId: otherAccountRes.body.data.id,
        toAccountId: accountA,
        categoryId: otherCategoryRes.body.data.id,
        movementType: transferType,
      })
      .expect(404);

    await prisma.category.delete({
      where: { id: otherCategoryRes.body.data.id },
    });
    await prisma.account.delete({
      where: { id: otherAccountRes.body.data.id },
    });
  });
});
