import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createAuthenticatedUser, createTestApp } from '../utils/test-app';

describe('Account (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ token } = await createAuthenticatedUser(app));
  });

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  it('creates an account with balanceCents starting at 0', async () => {
    const res = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Checking-${Date.now()}`, type: 'AT02' })
      .expect(201);

    const id = res.body.data.id;
    createdIds.push(id);

    await request(app.getHttpServer())
      .get(`/accounts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((getRes) => {
        expect(getRes.body.data.balanceCents).toBe(0);
        expect(getRes.body.data.type).toBe('AT02');
      });
  });

  it('creates an AT03 (Crédito) account with creditLimitCents and returns it', async () => {
    const res = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `CreditCard-${Date.now()}`,
        type: 'AT03',
        creditLimitCents: 50000000,
      })
      .expect(201);

    const id = res.body.data.id;
    createdIds.push(id);

    await request(app.getHttpServer())
      .get(`/accounts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((getRes) => {
        expect(getRes.body.data.creditLimitCents).toBe(50000000);
        expect(getRes.body.data.type).toBe('AT03');
      });
  });

  it('rejects creating an AT03 account without creditLimitCents', async () => {
    await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `NoCreditLimit-${Date.now()}`, type: 'AT03' })
      .expect(400);
  });

  it.each(['AT01', 'AT02', 'AT04'])(
    'rejects providing creditLimitCents for a %s (non-Crédito) account',
    async (type) => {
      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `WithCreditLimit-${type}-${Date.now()}`,
          type,
          creditLimitCents: 50000,
        })
        .expect(400);
    },
  );

  it('rejects an invalid account type', async () => {
    await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Invalid', type: 'crypto-wallet' })
      .expect(400);
  });

  it('updates name, type and isActive', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Savings-${Date.now()}`, type: 'AT02' })
      .expect(201);
    const id = createRes.body.data.id;
    createdIds.push(id);

    await request(app.getHttpServer())
      .patch(`/accounts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'AT01', isActive: false })
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toEqual({ id });
      });

    const account = await prisma.account.findUniqueOrThrow({ where: { id } });
    expect(account.type).toBe('AT01');
    expect(account.isActive).toBe(false);
  });

  it('🔍 rejects an invalid type on update the same way as create', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Checking-${Date.now()}`, type: 'AT02' })
      .expect(201);
    createdIds.push(createRes.body.data.id);

    await request(app.getHttpServer())
      .patch(`/accounts/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'crypto-wallet' })
      .expect(400);
  });

  it('returns 404 for a nonexistent account id', async () => {
    await request(app.getHttpServer())
      .get('/accounts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('🔍 rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/accounts').expect(401);
  });

  it('🔍 blocks deleting an account referenced by a movement', async () => {
    const accountRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Referenced-${Date.now()}`, type: 'AT02' })
      .expect(201);
    const accountId = accountRes.body.data.id;
    createdIds.push(accountId);

    const categoryRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Cat-${Date.now()}`,
        icon: 'pricetag-outline',
        movementType: 'MT01',
      })
      .expect(201);
    const categoryId = categoryRes.body.data.id;

    const movementRes = await request(app.getHttpServer())
      .post('/movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountCents: 100,
        date: new Date().toISOString(),
        accountId,
        categoryId,
        movementType: 'MT01',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await prisma.movement.delete({ where: { id: movementRes.body.data.id } });
    await prisma.category.delete({ where: { id: categoryId } });
    await request(app.getHttpServer())
      .delete(`/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    createdIds.splice(createdIds.indexOf(accountId), 1);
  });

  it("🔍 a second user cannot see, update, or delete the first user's account", async () => {
    const createRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Private-${Date.now()}`, type: 'AT02' })
      .expect(201);
    const accountId = createRes.body.data.id;
    createdIds.push(accountId);

    const { token: otherToken } = await createAuthenticatedUser(app);

    const listRes = await request(app.getHttpServer())
      .get('/accounts')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(
      listRes.body.data.some((acc: { id: string }) => acc.id === accountId),
    ).toBe(false);

    await request(app.getHttpServer())
      .get(`/accounts/${accountId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/accounts/${accountId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/accounts/${accountId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  // One consolidated e2e test walking through every isPrincipal business rule
  // on a single fresh user, rather than one fresh user per rule — sign-up is
  // rate-limited at 5 requests/60s per IP (shared across sign-up/sign-in, see
  // AGENTS.md), and this spec already spends one sign-up on `beforeAll` and
  // one on the "second user" test above, so budget for extra sign-ups here
  // is tight.
  it('🔍 enforces the full principal-account lifecycle: atomic switch, reject direct unset, block delete', async () => {
    const { token: freshToken } = await createAuthenticatedUser(app);

    // Sign-up already auto-provisions the default account set (see
    // openspec/changes/add-default-user-template) — "Principal" (AT02) is
    // the one created with isPrincipal:true, so there is no longer a
    // literal "first account ever created" to auto-infer principal from via
    // the API; that inference itself is unit-tested directly in
    // create-account.use-case.spec.ts ("defaults isPrincipal to false for a
    // second (or later) account"). This test instead starts from the
    // already-provisioned Principal account and a second account created
    // through the API.
    const listRes = await request(app.getHttpServer())
      .get('/accounts')
      .set('Authorization', `Bearer ${freshToken}`)
      .expect(200);
    const firstId = listRes.body.data.find(
      (acc: { name: string }) => acc.name === 'Principal',
    ).id;

    const secondRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ name: `Second-${Date.now()}`, type: 'AT01' })
      .expect(201);
    const secondId = secondRes.body.data.id;
    createdIds.push(secondId);

    // The provisioned Principal account is the current principal; the new
    // account defaults to non-principal.
    await request(app.getHttpServer())
      .get(`/accounts/${firstId}`)
      .set('Authorization', `Bearer ${freshToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.isPrincipal).toBe(true);
      });

    await request(app.getHttpServer())
      .get(`/accounts/${secondId}`)
      .set('Authorization', `Bearer ${freshToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.isPrincipal).toBe(false);
      });

    // Directly unsetting the current principal is rejected.
    await request(app.getHttpServer())
      .patch(`/accounts/${firstId}`)
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ isPrincipal: false })
      .expect(400);

    // Making the second account principal atomically unsets the first.
    await request(app.getHttpServer())
      .patch(`/accounts/${secondId}`)
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ isPrincipal: true })
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toEqual({ id: secondId });
      });

    await request(app.getHttpServer())
      .get(`/accounts/${firstId}`)
      .set('Authorization', `Bearer ${freshToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.isPrincipal).toBe(false);
      });

    await request(app.getHttpServer())
      .get(`/accounts/${secondId}`)
      .set('Authorization', `Bearer ${freshToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.isPrincipal).toBe(true);
      });

    // The (new) principal account cannot be deleted...
    await request(app.getHttpServer())
      .delete(`/accounts/${secondId}`)
      .set('Authorization', `Bearer ${freshToken}`)
      .expect(400);

    // ...but the now-non-principal first account (the provisioned
    // Principal, never pushed to createdIds since afterAll never created
    // it) can be, since it has zero referencing movements.
    await request(app.getHttpServer())
      .delete(`/accounts/${firstId}`)
      .set('Authorization', `Bearer ${freshToken}`)
      .expect(200);
  });
});
