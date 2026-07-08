import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health with no auth returns 200 and reports the database as up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toEqual({
      statusCode: 200,
      message: 'ok',
      data: { database: 'up' },
    });
  });

  it('🔍 an existing protected route still requires auth (the @Public() bypass did not leak)', async () => {
    await request(app.getHttpServer()).get('/accounts').expect(401);
  });
});
