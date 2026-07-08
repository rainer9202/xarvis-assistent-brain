import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

// Kept isolated in its own file/app instance (see AGENTS.md) so a flaky or
// slow rate-limit window never blocks the rest of the e2e suite.
describe('Auth rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('🔍 returns 429 after exceeding the 5-req/60s limit on /auth/sign-in/email', async () => {
    // The configured limit for this path is 5 requests per 60s window
    // (auth.provider.ts's `customRules`) — loop generously past it so the
    // assertion isn't sensitive to exact timing.
    const attempts = 8;
    const statuses: number[] = [];

    for (let i = 0; i < attempts; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/sign-in/email')
        .send({ email: 'nobody@example.com', password: 'wrong-password' });
      statuses.push(res.status);
    }

    expect(statuses).toContain(429);
  });
});
