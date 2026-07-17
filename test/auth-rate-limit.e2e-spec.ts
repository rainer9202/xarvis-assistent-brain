import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

// Kept isolated in its own file/app instance (see AGENTS.md) so a flaky or
// slow rate-limit window never blocks the rest of the e2e suite.
describe('Auth rate limiting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await app.close();
  });

  it('returns 429 after exceeding the 5-req/60s limit on /auth/sign-in', async () => {
    // The configured limit for this path is 5 requests per 60s window
    // (ThrottlerModule.forRoot in auth.module.ts + @UseGuards(ThrottlerGuard)
    // on AuthController) — loop generously past it so the assertion isn't
    // sensitive to exact timing. This file gets its own app instance (see
    // createTestApp), and doesn't set a custom X-Forwarded-For, so all of
    // its requests intentionally share one bucket per real client IP.
    const attempts = 16;
    const statuses: number[] = [];

    for (let i = 0; i < attempts; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .send({ email: 'nobody@example.com', password: 'wrong-password' });
      statuses.push(res.status);
    }

    expect(statuses).toContain(429);
  });

  it('returns 429 after exceeding the 5-req/60s limit on /auth/sign-up', async () => {
    const attempts = 16;
    const statuses: number[] = [];

    for (let i = 0; i < attempts; i++) {
      const email = `rate-limit-${i}-${Date.now()}@example.com`;
      createdEmails.push(email);
      const res = await request(app.getHttpServer())
        .post('/auth/sign-up')
        .send({ name: 'Rate Limit User', email, password: 'password123' });
      statuses.push(res.status);
    }

    expect(statuses).toContain(429);
  });

  // design.md ADR-6: GET/PATCH /auth/me carry @SkipThrottle() specifically
  // so they don't inherit AuthController's class-level 5-req/60s
  // ThrottlerGuard, which exists only to deter sign-up/sign-in brute
  // force. Without it, this suite (and any real profile screen polling on
  // focus) would be throttle-fragile. The one-off sign-up call below uses
  // its own simulated client IP (the two tests above already exhausted the
  // shared-bucket real IP's /auth/sign-up quota) purely to get a token —
  // the actual assertion (GET/PATCH /auth/me never 429s, even looped past
  // the limit) reuses the shared real IP with no custom header, so a real
  // 429 on a throttled route would already have fired if the exemption
  // didn't hold.
  it('/auth/me GET and PATCH are exempt from the 5-req/60s throttle', async () => {
    const email = `rate-limit-me-${Date.now()}@example.com`;
    createdEmails.push(email);
    const signUpRes = await request(app.getHttpServer())
      .post('/auth/sign-up')
      .set('X-Forwarded-For', '203.0.113.201')
      .send({
        name: 'Throttle Exempt User',
        email,
        password: 'password123',
        birthDate: '1990-05-20',
      })
      .expect(201);
    const token = signUpRes.body.data.accessToken as string;

    const attempts = 16;
    const getStatuses: number[] = [];
    const patchStatuses: number[] = [];

    for (let i = 0; i < attempts; i++) {
      const getRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);
      getStatuses.push(getRes.status);

      const patchRes = await request(app.getHttpServer())
        .patch('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Throttle Exempt User ${i}` });
      patchStatuses.push(patchRes.status);
    }

    expect(getStatuses).not.toContain(429);
    expect(patchStatuses).not.toContain(429);
    expect(getStatuses.every((status) => status === 200)).toBe(true);
    expect(patchStatuses.every((status) => status === 200)).toBe(true);
  });
});
