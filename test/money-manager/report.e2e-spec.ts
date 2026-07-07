import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createAuthenticatedUser, createTestApp } from '../utils/test-app';

describe('Report (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string;
  let expenseTypeId: string;
  let categoryId: string;
  const accountIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ cookie, userId } = await createAuthenticatedUser(app));

    expenseTypeId = (
      await prisma.movementType.findFirstOrThrow({ where: { name: 'expense' } })
    ).id;
    categoryId = (
      await prisma.category.create({
        data: {
          name: `ReportSpec-${Date.now()}`,
          movementTypeId: expenseTypeId,
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
        data: { name: `RA-${Date.now()}`, type: 'bank', userId },
      }),
      prisma.account.create({
        data: { name: `RB-${Date.now()}`, type: 'cash', userId },
      }),
    ]);
    accountIds.push(a.id, b.id);

    await request(app.getHttpServer())
      .post('/movements')
      .set('Cookie', cookie)
      .send({
        amountCents: 1500,
        date: new Date().toISOString(),
        accountId: a.id,
        categoryId,
        movementTypeId: expenseTypeId,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/reports/balance')
      .set('Cookie', cookie)
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
    const { cookie: otherCookie } = await createAuthenticatedUser(app);

    const res = await request(app.getHttpServer())
      .get('/reports/balance')
      .set('Cookie', otherCookie)
      .expect(200);

    expect(res.body.data.accounts).toEqual([]);
    expect(res.body.data.totalBalanceCents).toBe(0);
  });
});
