import express from 'express';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { toNodeHandler } from 'better-auth/node';
import request from 'supertest';
import { PrismaService } from '@config/database/prisma.service';
import { AUTH, Auth } from '@config/auth/auth.provider';
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

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });

  const auth = app.get<Auth>(AUTH);
  app.getHttpAdapter().getInstance().all('/auth/*splat', toNodeHandler(auth));
  app.use(express.json());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

// Signs up a fresh, uniquely-emailed user against the real auth mechanism
// and returns the session cookie so e2e specs can authenticate requests
// exactly like a real client would, plus the new user's id for direct
// Prisma fixture setup.
export async function createAuthenticatedUser(
  app: INestApplication,
): Promise<{ cookie: string; userId: string }> {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  const res = await request(app.getHttpServer())
    .post('/auth/sign-up/email')
    .send({ email, password: 'password123', name: 'Test User' })
    .expect(200);

  const cookie = res.headers['set-cookie'];
  if (!cookie) throw new Error('Sign-up did not return a session cookie');

  return {
    cookie: Array.isArray(cookie) ? cookie.join('; ') : cookie,
    userId: res.body.user.id,
  };
}
