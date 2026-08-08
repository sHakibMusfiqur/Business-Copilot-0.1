import type { NextFunction, Request, Response } from 'express';

import {
  REQUEST_ID_HEADER,
  generateRequestId,
  requestIdMiddleware,
  resolveRequestId,
  sanitizeRequestIdValue,
} from './request-id';

function makeRequest(): Request {
  return { headers: {}, ip: '127.0.0.1' } as unknown as Request;
}
function makeResponse(): Response {
  return { setHeader: jest.fn() } as unknown as Response;
}

describe('request-id', () => {
  describe('sanitizeRequestIdValue', () => {
    it('accepts a safe bounded id', () => {
      expect(sanitizeRequestIdValue('aBc_123-4.5')).toBe('aBc_123-4.5');
    });

    it('returns null for unsafe, malformed, or oversized ids', () => {
      expect(sanitizeRequestIdValue('has space')).toBeNull();
      expect(sanitizeRequestIdValue('semi;colon')).toBeNull();
      expect(sanitizeRequestIdValue('</script>')).toBeNull();
      expect(sanitizeRequestIdValue('a'.repeat(200))).toBeNull();
      expect(sanitizeRequestIdValue('')).toBeNull();
      expect(sanitizeRequestIdValue(undefined)).toBeNull();
      expect(sanitizeRequestIdValue(123)).toBeNull();
    });
  });

  describe('generateRequestId', () => {
    it('produces a UUID-like string', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(generateRequestId()).not.toBe(id);
    });
  });

  describe('resolveRequestId', () => {
    it('reuses a valid client id and replaces unsafe ones', () => {
      expect(resolveRequestId('my-id-1')).toBe('my-id-1');
      const replaced = resolveRequestId('bad/id');
      expect(replaced).not.toBe('bad/id');
      expect(replaced).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('requestIdMiddleware', () => {
    it('accepts a safe client header and echoes it', () => {
      const req = makeRequest();
      req.headers[REQUEST_ID_HEADER] = 'client-42';
      const res = makeResponse();
      const next: NextFunction = jest.fn();

      requestIdMiddleware(req, res, next);

      expect(req.requestId).toBe('client-42');
      expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'client-42');
      expect(next).toHaveBeenCalled();
    });

    it('replaces an unsafe client header with a generated id', () => {
      const req = makeRequest();
      req.headers[REQUEST_ID_HEADER] = '</script>';
      const res = makeResponse();
      const next: NextFunction = jest.fn();

      requestIdMiddleware(req, res, next);

      expect(req.requestId).not.toBe('</script>');
      expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, req.requestId);
    });

    it('generates an id when no header is present', () => {
      const req = makeRequest();
      const res = makeResponse();
      const next: NextFunction = jest.fn();

      requestIdMiddleware(req, res, next);

      expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, req.requestId);
    });
  });
});