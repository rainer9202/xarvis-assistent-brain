import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createTestApp } from '../utils/test-app';

// @nestjs/throttler's ThrottlerGuard (applied to AuthController — see
// auth.module.ts) keys rate-limit buckets by class+handler+IP. All requests
// in this file come from the same real client IP (loopback), so every test
// hitting the same /auth/sign-up or /auth/sign-in handler would otherwise
// share ONE bucket and could trip a spurious 429 once the file's total call
// count crosses the real 5-req/60s limit — unrelated to what each test is
// actually asserting. test/setup-env.ts trusts the 'loopback' proxy preset
// so this simulated per-test X-Forwarded-For is honored, giving every test
// its own bucket regardless of how many functional tests get added later.
let clientIpCounter = 0;
function nextTestClientIp(): string {
  clientIpCounter += 1;
  return `203.0.113.${clientIpCounter}`;
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  it('signs up a new user, returns a usable accessToken, and it works against a protected route', async () => {
    const email = `auth-e2e-${Date.now()}@example.com`;
    const clientIp = nextTestClientIp();

    const signUpRes = await request(app.getHttpServer())
      .post('/auth/sign-up')
      .set('X-Forwarded-For', clientIp)
      .send({ name: 'Auth E2E User', email, password: 'password123' })
      .expect(201);

    expect(signUpRes.body.data.id).toEqual(expect.any(String));
    expect(signUpRes.body.data.accessToken).toEqual(expect.any(String));
    createdUserIds.push(signUpRes.body.data.id);

    await request(app.getHttpServer())
      .get('/accounts')
      .set('Authorization', `Bearer ${signUpRes.body.data.accessToken}`)
      .expect(200);
  });

  it('🔍 rejects sign-up with a duplicate email with 409', async () => {
    const email = `auth-e2e-dup-${Date.now()}@example.com`;
    const clientIp = nextTestClientIp();

    const firstRes = await request(app.getHttpServer())
      .post('/auth/sign-up')
      .set('X-Forwarded-For', clientIp)
      .send({ name: 'First User', email, password: 'password123' })
      .expect(201);
    createdUserIds.push(firstRes.body.data.id);

    await request(app.getHttpServer())
      .post('/auth/sign-up')
      .set('X-Forwarded-For', clientIp)
      .send({ name: 'Second User', email, password: 'password456' })
      .expect(409);
  });

  it('🔍 handles two genuinely concurrent sign-ups for the same email: exactly one 201, the other a clean 409 (not 500)', async () => {
    // Unlike the sequential test above (which exercises SignUpUseCase's
    // findByEmail-based check), this fires both requests at once via
    // Promise.all so both can race past that check before either write
    // lands — proving PrismaUserRepository.create() genuinely catches
    // Prisma's real P2002 unique-constraint error for this schema +
    // driver adapter (Prisma 7 + @prisma/adapter-pg), not just the
    // synthetic mocked error in prisma-user.repository.spec.ts.
    const email = `auth-e2e-concurrent-${Date.now()}@example.com`;
    const clientIp = nextTestClientIp();

    const [firstRes, secondRes] = await Promise.all([
      request(app.getHttpServer())
        .post('/auth/sign-up')
        .set('X-Forwarded-For', clientIp)
        .send({ name: 'Concurrent User A', email, password: 'password123' }),
      request(app.getHttpServer())
        .post('/auth/sign-up')
        .set('X-Forwarded-For', clientIp)
        .send({ name: 'Concurrent User B', email, password: 'password456' }),
    ]);

    const statuses = [firstRes.status, secondRes.status].sort();
    expect(statuses).toEqual([201, 409]);

    const winner = firstRes.status === 201 ? firstRes : secondRes;
    createdUserIds.push(winner.body.data.id);
  });

  it('signs in with correct credentials and returns a working token', async () => {
    const email = `auth-e2e-signin-${Date.now()}@example.com`;
    const clientIp = nextTestClientIp();

    const signUpRes = await request(app.getHttpServer())
      .post('/auth/sign-up')
      .set('X-Forwarded-For', clientIp)
      .send({ name: 'Sign In User', email, password: 'password123' })
      .expect(201);
    createdUserIds.push(signUpRes.body.data.id);

    const signInRes = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('X-Forwarded-For', clientIp)
      .send({ email, password: 'password123' })
      .expect(200);

    expect(signInRes.body.data.accessToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .get('/accounts')
      .set('Authorization', `Bearer ${signInRes.body.data.accessToken}`)
      .expect(200);
  });

  it('🔍 rejects sign-in with a wrong password with 401', async () => {
    const email = `auth-e2e-wrongpass-${Date.now()}@example.com`;
    const clientIp = nextTestClientIp();

    const signUpRes = await request(app.getHttpServer())
      .post('/auth/sign-up')
      .set('X-Forwarded-For', clientIp)
      .send({ name: 'Wrong Pass User', email, password: 'password123' })
      .expect(201);
    createdUserIds.push(signUpRes.body.data.id);

    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('X-Forwarded-For', clientIp)
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('🔍 rejects sign-in with an unknown email with 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('X-Forwarded-For', nextTestClientIp())
      .send({
        email: `unknown-${Date.now()}@example.com`,
        password: 'password123',
      })
      .expect(401);
  });

  it('🔍 rejects sign-in with a malformed/empty stored password hash with 401, not 500', async () => {
    const email = `auth-e2e-malformed-hash-${Date.now()}@example.com`;
    const created = await prisma.user.create({
      data: { name: 'Malformed Hash User', email, password: '' },
    });
    createdUserIds.push(created.id);

    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('X-Forwarded-For', nextTestClientIp())
      .send({ email, password: 'password123' })
      .expect(401);
  });

  it('rejects sign-up with an invalid email with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-up')
      .set('X-Forwarded-For', nextTestClientIp())
      .send({
        name: 'Invalid Email User',
        email: 'not-an-email',
        password: 'password123',
      })
      .expect(400);
  });

  it('rejects sign-up with a too-short password with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-up')
      .set('X-Forwarded-For', nextTestClientIp())
      .send({
        name: 'Short Password User',
        email: `auth-e2e-shortpass-${Date.now()}@example.com`,
        password: 'short',
      })
      .expect(400);
  });

  it('rejects sign-up with a too-long password (>128 chars) with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-up')
      .set('X-Forwarded-For', nextTestClientIp())
      .send({
        name: 'Long Password User',
        email: `auth-e2e-longpass-${Date.now()}@example.com`,
        password: 'a'.repeat(129),
      })
      .expect(400);
  });

  it('rejects sign-up with a missing required field with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-up')
      .set('X-Forwarded-For', nextTestClientIp())
      .send({
        email: `auth-e2e-missing-name-${Date.now()}@example.com`,
        password: 'password123',
      })
      .expect(400);
  });

  it('rejects sign-in with an invalid email with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('X-Forwarded-For', nextTestClientIp())
      .send({ email: 'not-an-email', password: 'password123' })
      .expect(400);
  });

  it('rejects sign-in with a too-short password with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('X-Forwarded-For', nextTestClientIp())
      .send({ email: 'someone@example.com', password: 'short' })
      .expect(400);
  });

  it('rejects sign-in with a too-long password (>128 chars) with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('X-Forwarded-For', nextTestClientIp())
      .send({ email: 'someone@example.com', password: 'a'.repeat(129) })
      .expect(400);
  });

  it('rejects sign-in with a missing required field with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('X-Forwarded-For', nextTestClientIp())
      .send({ password: 'password123' })
      .expect(400);
  });

  it('rejects a protected route with a malformed/garbage Bearer token with 401', async () => {
    await request(app.getHttpServer())
      .get('/accounts')
      .set('Authorization', 'Bearer this-is-not-a-jwt')
      .expect(401);
  });

  it('rejects a protected route with an expired Bearer token with 401', async () => {
    // Signed with the same JWT_SECRET the running app uses (see
    // test/setup-env.ts) but with `exp` already in the past, so
    // jwtService.verifyAsync() inside the real JwtAuthGuard rejects it with
    // "jwt expired" instead of accepting it.
    const jwtService = new JwtService({ secret: process.env.JWT_SECRET });
    const expiredToken = jwtService.sign({
      sub: 'expired-user',
      email: 'expired@example.com',
      name: 'Expired User',
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    await request(app.getHttpServer())
      .get('/accounts')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });
});
