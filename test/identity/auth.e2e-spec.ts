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
      .send({
        name: 'Auth E2E User',
        email,
        password: 'password123',
        birthDate: '1990-05-20',
      })
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
      .send({
        name: 'First User',
        email,
        password: 'password123',
        birthDate: '1990-05-20',
      })
      .expect(201);
    createdUserIds.push(firstRes.body.data.id);

    await request(app.getHttpServer())
      .post('/auth/sign-up')
      .set('X-Forwarded-For', clientIp)
      .send({
        name: 'Second User',
        email,
        password: 'password456',
        birthDate: '1990-05-20',
      })
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
        .send({
          name: 'Concurrent User A',
          email,
          password: 'password123',
          birthDate: '1990-05-20',
        }),
      request(app.getHttpServer())
        .post('/auth/sign-up')
        .set('X-Forwarded-For', clientIp)
        .send({
          name: 'Concurrent User B',
          email,
          password: 'password456',
          birthDate: '1990-05-20',
        }),
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
      .send({
        name: 'Sign In User',
        email,
        password: 'password123',
        birthDate: '1990-05-20',
      })
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
      .send({
        name: 'Wrong Pass User',
        email,
        password: 'password123',
        birthDate: '1990-05-20',
      })
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

  describe('GET/PATCH /auth/me', () => {
    // Signs up directly (rather than via createAuthenticatedUser) so the
    // birthDate is known up front — needed to pin the 'YYYY-MM-DD'
    // date-format contract (design.md ADR-2) rather than asserting against
    // a null value.
    async function signUpProfileUser() {
      const email = `auth-e2e-profile-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
      const clientIp = nextTestClientIp();

      const signUpRes = await request(app.getHttpServer())
        .post('/auth/sign-up')
        .set('X-Forwarded-For', clientIp)
        .send({
          name: 'Profile E2E User',
          email,
          password: 'password123',
          birthDate: '1990-05-20',
        })
        .expect(201);
      createdUserIds.push(signUpRes.body.data.id);

      return {
        token: signUpRes.body.data.accessToken as string,
        userId: signUpRes.body.data.id as string,
        email,
      };
    }

    it('GET /auth/me returns 200 with the full profile matching the signed-up user', async () => {
      const { token, userId, email } = await signUpProfileUser();

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toEqual({
        id: userId,
        name: 'Profile E2E User',
        email,
        birthDate: '1990-05-20',
      });
    });

    it('GET /auth/me with no token returns 401', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('PATCH /auth/me with only name updates name, leaves birthDate unchanged, returns the full profile', async () => {
      const { token, userId, email } = await signUpProfileUser();

      const res = await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.data).toEqual({
        id: userId,
        name: 'Updated Name',
        email,
        birthDate: '1990-05-20',
      });
    });

    it('PATCH /auth/me with only birthDate reflects the new date as YYYY-MM-DD', async () => {
      const { token } = await signUpProfileUser();

      const res = await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ birthDate: '1995-01-15' })
        .expect(200);

      expect(res.body.data.birthDate).toBe('1995-01-15');
      expect(res.body.data.name).toBe('Profile E2E User');
    });

    it('PATCH /auth/me with email/password in the body returns 200 (not 400) and leaves them unchanged (global whitelist strip, ADR-3)', async () => {
      const { token, userId, email } = await signUpProfileUser();

      const res = await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Still Updated',
          email: 'someone-else@example.com',
          password: 'a-new-password',
        })
        .expect(200);

      // email/password are stripped by the global whitelist ValidationPipe
      // before the DTO is even built — the response proves the original
      // email is untouched, and a subsequent sign-in with the original
      // password (below) proves the password was never touched either.
      expect(res.body.data).toEqual({
        id: userId,
        name: 'Still Updated',
        email,
        birthDate: '1990-05-20',
      });

      await request(app.getHttpServer())
        .post('/auth/sign-in')
        .set('X-Forwarded-For', nextTestClientIp())
        .send({ email, password: 'password123' })
        .expect(200);
    });

    it('PATCH /auth/me with a full ISO-8601 datetime birthDate returns 400 (must be YYYY-MM-DD only)', async () => {
      const { token } = await signUpProfileUser();

      await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ birthDate: '1995-05-20T23:30:00-05:00' })
        .expect(400);
    });

    it('PATCH /auth/me with no token returns 401', async () => {
      await request(app.getHttpServer())
        .patch('/auth/me')
        .send({ name: 'No Token User' })
        .expect(401);
    });
  });

  describe('POST /auth/refresh and POST /auth/logout', () => {
    // Signs up directly (rather than createAuthenticatedUser) so the
    // returned refreshToken is available — createAuthenticatedUser only
    // returns { token, userId }. Returns clientIp too so every subsequent
    // refresh/logout call in the SAME test reuses it: ThrottlerGuard keys
    // its bucket by class+handler+IP (see the file-level comment above), so
    // reusing one IP across a test's own refresh/logout calls stays well
    // under the 5-req/60s handler bucket while still giving each TEST its
    // own isolated bucket via nextTestClientIp().
    async function signUpForRefreshFlow() {
      const email = `auth-e2e-refresh-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
      const clientIp = nextTestClientIp();

      const signUpRes = await request(app.getHttpServer())
        .post('/auth/sign-up')
        .set('X-Forwarded-For', clientIp)
        .send({
          name: 'Refresh Flow User',
          email,
          password: 'password123',
          birthDate: '1990-05-20',
        })
        .expect(201);
      createdUserIds.push(signUpRes.body.data.id);

      return {
        clientIp,
        email,
        userId: signUpRes.body.data.id as string,
        accessToken: signUpRes.body.data.accessToken as string,
        refreshToken: signUpRes.body.data.refreshToken as string,
      };
    }

    it('sign-up response includes a refreshToken alongside id/accessToken, distinct from the access token', async () => {
      const { userId, accessToken, refreshToken } =
        await signUpForRefreshFlow();

      expect(userId).toEqual(expect.any(String));
      expect(accessToken).toEqual(expect.any(String));
      expect(refreshToken).toEqual(expect.any(String));
      expect(refreshToken).not.toEqual(accessToken);
    });

    it('sign-in response includes a refreshToken alongside id/accessToken', async () => {
      const { email, clientIp, userId } = await signUpForRefreshFlow();

      const signInRes = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .set('X-Forwarded-For', clientIp)
        .send({ email, password: 'password123' })
        .expect(200);

      expect(signInRes.body.data.id).toEqual(userId);
      expect(signInRes.body.data.accessToken).toEqual(expect.any(String));
      expect(signInRes.body.data.refreshToken).toEqual(expect.any(String));
    });

    it('POST /auth/refresh with a valid token returns 200 with a NEW access+refresh pair, the new access token works against a protected route, and the OLD refresh token then returns 401 on reuse', async () => {
      const { clientIp, refreshToken: oldRefreshToken } =
        await signUpForRefreshFlow();

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('X-Forwarded-For', clientIp)
        .send({ refreshToken: oldRefreshToken })
        .expect(200);

      expect(refreshRes.body.data.accessToken).toEqual(expect.any(String));
      expect(refreshRes.body.data.refreshToken).toEqual(expect.any(String));
      expect(refreshRes.body.data.refreshToken).not.toEqual(oldRefreshToken);

      await request(app.getHttpServer())
        .get('/accounts')
        .set('Authorization', `Bearer ${refreshRes.body.data.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('X-Forwarded-For', clientIp)
        .send({ refreshToken: oldRefreshToken })
        .expect(401);
    });

    it('🔍 reusing an already-rotated/revoked refresh token returns 401 with the IDENTICAL body shape as an unknown token (no info leak)', async () => {
      const { clientIp, refreshToken: oldRefreshToken } =
        await signUpForRefreshFlow();

      // Rotate once so oldRefreshToken becomes revoked.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('X-Forwarded-For', clientIp)
        .send({ refreshToken: oldRefreshToken })
        .expect(200);

      const reuseRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('X-Forwarded-For', clientIp)
        .send({ refreshToken: oldRefreshToken })
        .expect(401);

      const unknownRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('X-Forwarded-For', clientIp)
        .send({ refreshToken: 'this-token-never-existed' })
        .expect(401);

      // Both branches throw the same bare UnauthorizedException (design.md's
      // reuse-detection ADR) — asserting deep body equality proves a reused
      // token is genuinely indistinguishable from one that never existed.
      expect(reuseRes.body).toEqual(unknownRes.body);
    });

    it('POST /auth/logout returns 200, a subsequent refresh with that token returns 401, and logout is idempotent (still 200 on repeat)', async () => {
      const { clientIp, refreshToken } = await signUpForRefreshFlow();

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('X-Forwarded-For', clientIp)
        .send({ refreshToken })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('X-Forwarded-For', clientIp)
        .send({ refreshToken })
        .expect(401);

      // Idempotent: logging out again with the same (already-revoked) token
      // still succeeds — LogoutUseCase never throws.
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('X-Forwarded-For', clientIp)
        .send({ refreshToken })
        .expect(200);
    });

    it('🔍 a refresh-typed token presented as a Bearer access token on a protected route returns 401, proving JwtAuthGuard rejects token-type confusion', async () => {
      const { refreshToken } = await signUpForRefreshFlow();

      await request(app.getHttpServer())
        .get('/accounts')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(401);
    });
  });
});
