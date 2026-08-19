import 'reflect-metadata';
import { Controller, Module, Post, Req } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';

const IPN = 'status=VALID&val_id=test-val-id&tran_id=payment-id&amount=8690.00&currency=BDT';

@Controller('webhooks')
class ProbeController {
  @Post('sslcommerz')
  probe(@Req() req: Request) {
    const raw = (req as Request & { rawBody?: Buffer | string }).rawBody;
    return {
      raw: raw === undefined ? null : Buffer.isBuffer(raw) ? raw.toString('utf8') : raw,
      body: req.body,
      contentType: req.headers['content-type'],
    };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

function post(
  port: number,
  path: string,
  contentType: string,
  body: string,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': contentType } },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text: data }));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

describe('Express rawBody capture for SSLCommerz IPN (rawBody: true)', () => {
  it.each([
    [
      'application/x-www-form-urlencoded',
      IPN,
      { status: 'VALID', val_id: 'test-val-id', tran_id: 'payment-id', amount: '8690.00', currency: 'BDT' },
    ],
    ['application/json', '{"a":1}', { a: 1 }],
  ])('attaches req.rawBody and parses req.body for %s', async (contentType, raw, expectedBody) => {
    const app = await NestFactory.create<NestExpressApplication>(ProbeModule, { rawBody: true });
    await app.listen(0);
    try {
      const address = app.getHttpServer().address() as AddressInfo;
      const res = await post(address.port, '/webhooks/sslcommerz', contentType as string, raw as string);
      expect(res.status).toBe(201);
      const json = JSON.parse(res.text);
      expect(json.raw).toBe(raw); // exact raw bytes preserved
      expect(json.body).toEqual(expectedBody); // parsed body still available
    } finally {
      await app.close();
    }
  }, 15000);
});