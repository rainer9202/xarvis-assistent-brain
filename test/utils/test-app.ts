import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@config/database/prisma.service';
import { getTrustedProxies } from '@config/env/get-trusted-proxies';
import { DomainExceptionFilter } from '@shared/exceptions/http-exception.filter';
import { ResponseInterceptor } from '@shared/interceptors/response.interceptor';
import { AppModule } from '../../src/app.module';

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();

  // Mirrors main.ts's bootstrap(), which this test harness bypasses
  // entirely (it builds the Nest application directly instead of going
  // through the real bootstrap function) — without this, @nestjs/throttler's
  // ThrottlerGuard.getTracker (=> req.ip) never resolves X-Forwarded-For,
  // and test/identity/auth.e2e-spec.ts's per-test simulated client IPs would
  // silently have no effect.
  app.set('trust proxy', getTrustedProxies());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

// Signs up a fresh, uniquely-emailed user through the real `/auth/sign-up`
// route (hand-rolled JWT auth — see `src/modules/identity/auth`) and returns
// a bearer token every other e2e spec attaches via
// `.set('Authorization', \`Bearer ${token}\`)`. Renamed from the old
// `{ cookie, userId }` shape now that auth is JWT-based, not cookie-based.
export async function createAuthenticatedUser(
  app: INestApplication,
): Promise<{ token: string; userId: string }> {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  const res = await request(app.getHttpServer())
    .post('/auth/sign-up')
    .send({ name: 'Test User', email, password: 'password123' })
    .expect(201);

  return { token: res.body.data.accessToken, userId: res.body.data.id };
}
