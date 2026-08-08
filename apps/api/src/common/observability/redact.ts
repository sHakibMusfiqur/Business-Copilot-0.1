/** Constant used in place of any value that must not be logged. */
export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_TOKENS = new Set<string>([
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'refreshtoken',
  'accesstoken',
  'token',
  'authorization',
  'auth',
  'cookie',
  'secret',
  'apikey',
  'apisecret',
  'clientsecret',
  'stripesecret',
  'stripekey',
  'webhooksecret',
  'webhookkey',
  'databaseurl',
  'dburl',
  'redisurl',
]);


export function isSensitiveKey(key: string): boolean {
  if (typeof key !== 'string' || key.length === 0) return false;
  const normalized = key
    .replace(/[-_]/g, '')
    .replace(/\s/g, '')
    .toLowerCase();
  return SENSITIVE_KEY_TOKENS.has(normalized);
}

export function redactSensitiveFields<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item)) as unknown as T;
  }

  const cloned: Record<string, unknown> = {};
  for (const [key, subValue] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      cloned[key] = REDACTED;
    } else if (typeof subValue === 'object' && subValue !== null) {
      cloned[key] = redactSensitiveFields(subValue);
    } else {
      cloned[key] = subValue;
    }
  }
  return cloned as unknown as T;
}


export function redactString(message: string, secrets: Array<string | null | undefined>): string {
  if (typeof message !== 'string' || message.length === 0) return message;
  let out = message;
  for (const secret of secrets) {
    if (!secret || secret.length < 4) continue;
    if (!out.includes(secret)) continue;
    out = out.split(secret).join(REDACTED);
  }
  return out;
}


export function redactUrlForLog(rawUrl?: string): string {
  if (!rawUrl) return '';
  const [path] = rawUrl.split('?');
  return path || '/';
}

/** Extracts a safe, redacted cookie list from the `Cookie` header value. */
export function redactCookieHeader(rawCookies: unknown): string {
  if (typeof rawCookies !== 'string' || !rawCookies) return '(none)';
  const names: string[] = [];
  for (const segment of rawCookies.split(';')) {
    const eq = segment.indexOf('=');
    const name = (eq === -1 ? segment.trim() : segment.slice(0, eq).trim());
    if (name) names.push(name);
  }
  return names.length > 0 ? names.join(',') : '(none)';
}