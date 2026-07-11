import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createAuthenticatedUser, createTestApp } from '../utils/test-app';

describe('Report (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const expenseType = 'Gasto';
  let categoryId: string;
  const accountIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ token, userId } = await createAuthenticatedUser(app));

    categoryId = (
      await prisma.category.create({
        data: {
          name: `ReportSpec-${Date.now()}`,
          movementType: expenseType,
          userId,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.movement.deleteMany({
      where: { accountId: { in: accountIds } },
    });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
    await app.close();
  });

  it('sums balanceCents across every account into a single total', async () => {
    const [a, b] = await Promise.all([
      prisma.account.create({
        data: { name: `RA-${Date.now()}`, type: 'AT02', userId },
      }),
      prisma.account.create({
        data: { name: `RB-${Date.now()}`, type: 'AT01', userId },
      }),
    ]);
    accountIds.push(a.id, b.id);

    await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 1500,
        date: new Date().toISOString(),
        accountId: a.id,
        categoryId,
        movementType: expenseType,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/reports/balance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const accountA = res.body.data.accounts.find(
      (acc: { id: string }) => acc.id === a.id,
    );
    const accountB = res.body.data.accounts.find(
      (acc: { id: string }) => acc.id === b.id,
    );
    expect(accountA.balanceCents).toBe(-1500);
    expect(accountB.balanceCents).toBe(0);

    const expectedTotal = res.body.data.accounts.reduce(
      (sum: number, acc: { balanceCents: number }) => sum + acc.balanceCents,
      0,
    );
    expect(res.body.data.totalBalanceCents).toBe(expectedTotal);
  });

  it("🔍 excludes other users' accounts from the report", async () => {
    const { token: otherToken } = await createAuthenticatedUser(app);

    const res = await request(app.getHttpServer())
      .get('/reports/balance')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);

    expect(res.body.data.accounts).toEqual([]);
    expect(res.body.data.totalBalanceCents).toBe(0);
  });
});
