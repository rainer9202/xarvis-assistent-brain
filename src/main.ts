import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { validateEnv } from '@config/env/validate-env';
import { getTrustedProxies } from '@config/env/get-trusted-proxies';
import { DomainExceptionFilter } from '@shared/exceptions/http-exception.filter';
import { ResponseInterceptor } from '@shared/interceptors/response.interceptor';

async function bootstrap() {
  // Fail fast on missing/invalid env vars before Nest starts booting — see
  // @config/env/validate-env.ts.
  validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Only trust X-Forwarded-For from these hops so @nestjs/throttler's
  // ThrottlerGuard (default getTracker => req.ip) resolves the real client
  // IP behind Dokploy's reverse proxy — see
  // @config/env/get-trusted-proxies.ts and AGENTS.md's "Authentication and
  // data ownership" section for the full rationale.
  app.set('trust proxy', getTrustedProxies());

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Xarvis Brain API')
    .setDescription('API de gestión financiera personal')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Every Nest-routed operation requires the bearer token by default (there's
  // no per-controller @ApiBearerAuth() to maintain as new modules are added).
  document.security = [{ bearer: [] }];

  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
