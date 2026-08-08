import 'reflect-metadata';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import type { Request, Response, NextFunction } from 'express';

import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { redactUrlForLog } from './common/observability/redact';
import { requestIdMiddleware } from './common/observability/request-id';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const requestLogger = new Logger('HTTP');

  // Fail fast and clearly on invalid/insecure environment configuration before
  // the application boots. The error lists only variable names, never values.
  const configService = new ConfigService();
  configService.validate();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.enableShutdownHooks();
  app.setGlobalPrefix(configService.apiPrefix);

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    // Hardening: serves uploaded files as inert assets. `sandbox` blocks any
    // script/HTML execution if a user-uploaded SVG/HTML were opened directly,
    // and `nosniff` prevents MIME sniffing of the byte stream.
    setHeaders: (res: Response) => {
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  app.enableCors({
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      const allowed = configService.corsOrigins;
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-onboarding-token'],
  });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Correlation ID middleware runs first so every request (and its logs and
  // any error responses) carries a request ID echoed in the x-request-id header.
  app.use(requestIdMiddleware);

  // Production-safe HTTP request/response logging. Logs only safe request ID,
  // method, sanitized path, origin, status, and duration. Never logs headers,
  // cookies, bodies, query strings, or full URLs (which may carry secrets).
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId ?? '(missing)';
    const startedAt = Date.now();
    const method = req.method;
    const path = redactUrlForLog(req.originalUrl);
    const origin = req.headers.origin ?? '(none)';

    requestLogger.log(
      `REQUEST id=${requestId} method=${method} path=${path} from=${req.ip ?? '?'} origin=${origin}`,
    );

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const { statusCode } = res;
      requestLogger.log(
        `RESPONSE id=${requestId} method=${method} path=${path} status=${statusCode} duration=${durationMs}ms`,
      );
    });

    next();
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger is an opt-in developer aid and must never be exposed in
  // production. It is disabled automatically when NODE_ENV=production.
  if (configService.swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle(configService.swaggerTitle)
      .setDescription(configService.swaggerDescription)
      .setVersion(configService.swaggerVersion)
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addCookieAuth('refresh_token')
      .addApiKey({ type: 'apiKey', name: 'x-tenant-id', in: 'header' }, 'x-tenant-id')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  const port = configService.port;
  await app.listen(port);

  logger.log(`Server running on http://localhost:${port}`);
  if (configService.swaggerEnabled) {
    logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
