import type {
  ExceptionFilter,
  ArgumentsHost,
} from '@nestjs/common';
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { REQUEST_ID_HEADER, resolveRequestId } from '../observability/request-id';
import { redactCookieHeader, redactString, redactUrlForLog } from '../observability/redact';
import { ConfigService } from '../../config/config.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
  stack?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly config: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object') {
        const resp = exResponse as Record<string, unknown>;
        message = (resp.message as string | string[]) ?? exception.message;
        error = (resp.error as string) ?? exception.name;
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      // Prisma errors are implementation details; map the two common classes to
      // user-meaningful status codes without ever leaking driver internals.
      if (exception.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        message = 'A record with the same unique value already exists';
        error = 'Conflict';
      } else if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        error = 'Not Found';
      }
    } else if (exception instanceof Error) {
 
      if (process.env.NODE_ENV === 'production') {
        message = 'Internal server error';
        error = 'Internal Server Error';
      } else {
        message = exception.message;
        error = exception.name;
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      message: this.sanitizeClientMessage(message, request.url),
      error,
      timestamp: new Date().toISOString(),
      path: redactUrlForLog(request.url),
    };

    // Echo the correlation ID on errors too so a failed request can be matched
    // against its request/response log entries. Ensures the header is set even
    // if the request-id middleware did not run for this path.
    const requestId = request.requestId ?? resolveRequestId(request.headers[REQUEST_ID_HEADER]);
    errorResponse.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      errorResponse.stack =
        typeof exception.stack === 'string' && request.url
          ? redactString(exception.stack, [request.url])
          : exception.stack;
    }

    // Server-side diagnostic log. Includes the correlation ID, sanitized path,
    // status, and the message without any sensitive request metadata. The message
    // and any stack are run through secret-redaction for extra safety. The raw
    // URL is also redacted because Nest echoes it into some messages (e.g. a 404
    // "Cannot GET /...?token=..."), which would otherwise leak query credentials.
    const secretValues = this.configSecretValues();
    const diagnosticSecrets = secretValues.concat(
      request.originalUrl ?? request.url,
      request.url,
    );
    const origin = request.headers.origin ?? '(none)';
    const cookies = redactCookieHeader(request.headers.cookie);
    const diagnosticMessage = redactString(JSON.stringify(message), diagnosticSecrets);

    // Capture the raw underlying cause for server-side debugging without ever
    // exposing it to clients. For non-HTTP errors the client only sees the
    // generic `message` above, but the log keeps the specific cause text (e.g.
    // the exact DB constraint) so it can still be diagnosed. HttpExceptions use
    // their already-meaningful message, so no separate detail is needed.
    const rawDetail =
      exception instanceof Error && !(exception instanceof HttpException)
        ? exception.message
        : undefined;
    const diagnosticDetail =
      rawDetail === undefined
        ? ''
        : ` detail=${redactString(JSON.stringify(rawDetail), diagnosticSecrets)}`;

    const diagnostic = `id=${requestId} method=${request.method} path=${redactUrlForLog(
      request.url,
    )} status=${statusCode} origin=${origin} cookies=${cookies} message=${diagnosticMessage}${diagnosticDetail}`;

    if (exception instanceof Error) {
      const redactedStack = redactString(exception.stack ?? '', diagnosticSecrets);
      this.logger.error(diagnostic, redactedStack || undefined);
    } else {
      this.logger.error(diagnostic);
    }

    response.status(statusCode).json(errorResponse);
  }

  /**
   * Sanitizes a client-facing error message. Nest echoes the full request URL
   * into some messages (e.g. a 404 "Cannot GET /path?token=..."), so we redact
   * the request URL (including any query) to avoid leaking credentials to
   * clients. Non-secret message content is left intact.
   */
  private sanitizeClientMessage(
    message: string | string[],
    rawUrl: string | undefined,
  ): string | string[] {
    if (!rawUrl) return message;
    const secrets = [rawUrl];
    const redactOne = (m: unknown): string =>
      typeof m === 'string' ? redactString(m, secrets) : String(m);
    return Array.isArray(message) ? message.map((m) => redactOne(m)) : redactOne(message);
  }

  /** Collects configured secrets so server-side logs never echo their values. */
  private configSecretValues(): string[] {
    const values: string[] = [];
    for (const v of [
      this.config.redisUrl,
      this.config.jwtSecret,
      this.config.jwtRefreshSecret,
      this.config.stripeSecretKey,
      this.config.stripeWebhookSecret,
      process.env.DATABASE_URL,
    ]) {
      if (v) values.push(v);
    }
    return values;
  }
}
