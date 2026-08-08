import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/** Header used to carry the correlation ID. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Maximum safe characters for a client-supplied request ID. */
const MAX_REQUEST_ID_LENGTH = 100;

/** Only these characters are allowed in a client-supplied request ID. */
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;


declare global {
  /* eslint-disable-next-line @typescript-eslint/no-namespace */
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}


export function sanitizeRequestIdValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_REQUEST_ID_LENGTH) return null;
  if (!SAFE_REQUEST_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/** Generates a fresh correlation ID (cryptographic UUID). */
export function generateRequestId(): string {
  return randomUUID();
}


export function resolveRequestId(raw: unknown): string {
  return sanitizeRequestIdValue(raw) ?? generateRequestId();
}


export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers[REQUEST_ID_HEADER];
  const raw = Array.isArray(header) ? header[0] : header;
  req.requestId = resolveRequestId(raw);
  res.setHeader(REQUEST_ID_HEADER, req.requestId);
  next();
}