import { BadRequestException } from '@nestjs/common';

import { ParseCuidPipe } from './parse-cuid.pipe';
import { ParseGatewayPipe } from './parse-gateway.pipe';
import { ParseEmailParamPipe } from './parse-email-param.pipe';
import { ParseSlugPipe } from './parse-slug.pipe';
import { ParseSettingsKeyPipe } from './parse-settings-key.pipe';
import { ParseSettingsNamespacePipe } from './parse-settings-namespace.pipe';

describe('parse-param pipes', () => {
  describe('ParseCuidPipe', () => {
    const pipe = new ParseCuidPipe();

    it('accepts a valid cuid', () => {
      expect(pipe.transform('clrm4lf020000agw3h2xjtr9s')).toBe('clrm4lf020000agw3h2xjtr9s');
    });

    it.each(['', 'not-a-cuid', 'x', 'c'.repeat(24), 123 as unknown as string])(
      'rejects invalid value %p',
      (value) => {
        expect(() => pipe.transform(value)).toThrow(BadRequestException);
      },
    );
  });

  describe('ParseGatewayPipe', () => {
    const pipe = new ParseGatewayPipe();

    it.each(['stripe', 'card', 'sslcommerz', 'bkash', 'nagad', 'paypal'])(
      'accepts %s',
      (value) => {
        expect(pipe.transform(value)).toBe(value);
      },
    );

    it('rejects an unsupported gateway', () => {
      expect(() => pipe.transform('unknown')).toThrow(BadRequestException);
    });
  });

  describe('ParseEmailParamPipe', () => {
    const pipe = new ParseEmailParamPipe();

    it('accepts a valid email', () => {
      expect(pipe.transform('user@example.com')).toBe('user@example.com');
    });

    it('rejects a malformed email', () => {
      expect(() => pipe.transform('not-an-email')).toThrow(BadRequestException);
    });
  });

  describe('ParseSlugPipe', () => {
    const pipe = new ParseSlugPipe();

    it('accepts a valid slug', () => {
      expect(pipe.transform('acme-co')).toBe('acme-co');
    });

    it.each(['Bad Slug', 'Acme Co!', 'a'.repeat(65)])('rejects %p', (value) => {
      expect(() => pipe.transform(value)).toThrow(BadRequestException);
    });
  });

  describe('ParseSettingsKeyPipe', () => {
    const pipe = new ParseSettingsKeyPipe();

    it('accepts dotted keys', () => {
      expect(pipe.transform('app.name')).toBe('app.name');
    });

    it('rejects injected keys', () => {
      expect(() => pipe.transform('../../etc')).toThrow(BadRequestException);
    });
  });

  describe('ParseSettingsNamespacePipe', () => {
    const pipe = new ParseSettingsNamespacePipe();

    it('accepts a known namespace', () => {
      expect(pipe.transform('branding')).toBe('branding');
    });

    it('rejects an unknown namespace', () => {
      expect(() => pipe.transform('../../etc')).toThrow(BadRequestException);
    });
  });
});