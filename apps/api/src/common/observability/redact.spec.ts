import {
  REDACTED,
  isSensitiveKey,
  redactCookieHeader,
  redactSensitiveFields,
  redactString,
  redactUrlForLog,
} from './redact';

describe('redact utility', () => {
  describe('isSensitiveKey', () => {
    it('flags common sensitive name variants', () => {
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('currentPassword')).toBe(true);
      expect(isSensitiveKey('new_password')).toBe(true);
      expect(isSensitiveKey('refreshToken')).toBe(true);
      expect(isSensitiveKey('accessToken')).toBe(true);
      expect(isSensitiveKey('token')).toBe(true);
      expect(isSensitiveKey('authorization')).toBe(true);
      expect(isSensitiveKey('apiKey')).toBe(true);
      expect(isSensitiveKey('stripeSecret')).toBe(true);
      expect(isSensitiveKey('webhookSecret')).toBe(true);
      expect(isSensitiveKey('DATABASE_URL')).toBe(true);
      expect(isSensitiveKey('REDIS_URL')).toBe(true);
    });

    it('does not flag harmless fields', () => {
      expect(isSensitiveKey('name')).toBe(false);
      expect(isSensitiveKey('email')).toBe(false);
      expect(isSensitiveKey('count')).toBe(false);
      expect(isSensitiveKey('database')).toBe(false);
      expect(isSensitiveKey('tokenCount')).toBe(false);
      expect(isSensitiveKey('notes')).toBe(false);
      expect(isSensitiveKey('')).toBe(false);
    });
  });

  describe('redactSensitiveFields', () => {
    it('redacts sensitive fields deeply while preserving structure', () => {
      const input = {
        email: 'jane@example.com',
        password: 'superSecret123',
        profile: { firstName: 'Jane', currentPassword: 'pw1', refreshToken: 'tok' },
        items: [{ apiKey: 'abc', name: 'x' }],
      };
      const out = redactSensitiveFields(input);
      expect(out.password).toBe(REDACTED);
      expect((out.profile as Record<string, unknown>).currentPassword).toBe(REDACTED);
      expect((out.profile as Record<string, unknown>).refreshToken).toBe(REDACTED);
      expect((out.items as Array<Record<string, unknown>>)[0].apiKey).toBe(REDACTED);

      expect(out.email).toBe('jane@example.com');
      expect((out.profile as Record<string, unknown>).firstName).toBe('Jane');
      expect((out.items as Array<Record<string, unknown>>)[0].name).toBe('x');
    });

    it('never emits the actual secret value after redaction', () => {
      const out = redactSensitiveFields({
        refreshToken: 'rt-super-secret-value',
        accessToken: 'at-super-secret-value',
      });
      expect(JSON.stringify(out)).not.toContain('super-secret-value');
      expect(JSON.stringify(out)).toContain(REDACTED);
    });

    it('passes primitives and null through unchanged', () => {
      expect(redactSensitiveFields('hello')).toBe('hello');
      expect(redactSensitiveFields(42)).toBe(42);
      expect(redactSensitiveFields(null)).toBeNull();
      expect(redactSensitiveFields(undefined)).toBeUndefined();
    });
  });

  describe('redactString', () => {
    it('removes known credential substrings', () => {
      const msg = 'Connection failed for redis://user:secret@host:6379';
      expect(redactString(msg, ['secret'])).not.toContain('secret');
      expect(redactString(msg, ['secret'])).toContain(REDACTED);
    });

    it('leaves messages without known secrets untouched', () => {
      const msg = 'user saved successfully';
      expect(redactString(msg, [null, '']) ).toBe(msg);
    });
  });

  describe('redactUrlForLog', () => {
    it('strips query strings entirely', () => {
      expect(redactUrlForLog('/auth/reset?token=abc123')).toBe('/auth/reset');
      expect(redactUrlForLog('/api/health')).toBe('/api/health');
    });

    it('handles empty and undefined safely', () => {
      expect(redactUrlForLog('')).toBe('');
      expect(redactUrlForLog(undefined)).toBe('');
    });
  });

  describe('redactCookieHeader', () => {
    it('lists cookie names without values', () => {
      expect(redactCookieHeader('session=abc; refresh_token=xyz; theme=dark')).toBe(
        'session,refresh_token,theme',
      );
    });

    it('handles non-string and empty inputs', () => {
      expect(redactCookieHeader(undefined)).toBe('(none)');
      expect(redactCookieHeader('')).toBe('(none)');
    });
  });
});