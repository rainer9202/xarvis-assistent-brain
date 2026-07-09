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
});
