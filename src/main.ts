import 'dotenv/config';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { AUTH, Auth } from '@config/auth/auth.provider';
import { DomainExceptionFilter } from '@shared/exceptions/http-exception.filter';
import { ResponseInterceptor } from '@shared/interceptors/response.interceptor';

async function bootstrap() {
  // bodyParser: false because Better-Auth's handler needs the raw request
  // body — Nest's default global body parser would already have consumed
  // it by the time the auth route runs otherwise.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // Registered before the raw auth mount below: Express runs middleware/routes
  // in registration order, and the auth handler responds directly without
  // calling next(), so CORS headers would never reach /auth/* otherwise.
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  const auth = app.get<Auth>(AUTH);
  app.getHttpAdapter().getInstance().all('/auth/*splat', toNodeHandler(auth));
  app.use(express.json());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Xarvis Brain API')
    .setDescription('API de gestión financiera personal')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
