const TRANSIENT_PATTERNS = [
  'timeout',
  'timed out',
  'deadlock',
  'connection refused',
  'connection reset',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'socket hang up',
  'database is down',
  'too many connections',
  'LockAcquisitionError',
  'deadlock detected',
  'serialization failure',
  'could not serialize access',
  '500',
  '502',
  '503',
  '504',
  'Service Unavailable',
  'Internal Server Error',
  'Bad Gateway',
  'Gateway Timeout',
  'retry later',
  'try again',
  'rate limit',
  'Too Many Requests',
  '429',
];

const NON_TRANSIENT_PATTERNS = [
  'not found',
  'Not Found',
  'invalid',
  'Invalid',
  'forbidden',
  'Forbidden',
  'unauthorized',
  'Unauthorized',
  'bad request',
  'Bad Request',
  'already exists',
  'Unique constraint',
  'not null',
  'NotNull',
  'violates foreign key',
  'violates check constraint',
  'validation failed',
  'ValidationError',
  'Malformed',
  'malformed',
];

export function isTransientError(error: Error): boolean {
  const message = error.message;
  const name = error.name;

  for (const pattern of NON_TRANSIENT_PATTERNS) {
    if (message.includes(pattern) || name.includes(pattern)) {
      return false;
    }
  }

  for (const pattern of TRANSIENT_PATTERNS) {
    if (message.includes(pattern) || name.includes(pattern)) {
      return true;
    }
  }

  return true;
}
