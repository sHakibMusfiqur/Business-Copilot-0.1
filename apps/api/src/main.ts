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

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const requestLogger = new Logger('HTTP');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');

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
      const allowed = [
        process.env.WEB_URL ?? 'http://localhost:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ].filter(Boolean) as string[];
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

  app.use((req: Request, res: Response, next: NextFunction) => {
    requestLogger.log(`>>> INCOMING ${req.method} ${req.originalUrl} from=${req.ip} origin=${req.headers.origin ?? '(none)'}`);
    const originalEnd = res.end.bind(res) as (...args: unknown[]) => ReturnType<Response['end']>;
    res.end = function (this: Response, ...args: unknown[]) {
      requestLogger.log(`<<< RESPONSE ${req.method} ${req.originalUrl} status=${res.statusCode}`);
      return originalEnd(...args);
    } as Response['end'];
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
  const isProduction = process.env.NODE_ENV === 'production';
  const isSwaggerEnabled = !isProduction && process.env.SWAGGER_ENABLED === 'true';
  if (isSwaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle(process.env.SWAGGER_TITLE ?? 'Business Copilot API')
      .setDescription(process.env.SWAGGER_DESCRIPTION ?? 'Enterprise ERP + AI Business Copilot API')
      .setVersion(process.env.SWAGGER_VERSION ?? '1.0')
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

  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  logger.log(`Server running on http://localhost:${port}`);
  if (isSwaggerEnabled) {
    logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
