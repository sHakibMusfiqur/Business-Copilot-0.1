import { api } from './client';
import { API_ROUTES } from './routes';

export async function checkApiHealth(): Promise<void> {
  await api.get(API_ROUTES.HEALTH);
}

/** Redis metrics from the API's RedisHealthService; `null` when Redis is disabled. */
export interface RedisHealthMetrics {
  status: 'connected' | 'disconnected' | 'reconnecting';
  latency: number | null;
  lastPing: number | null;
  lastFailure: number | null;
  reconnectCount: number;
}

/** Response of `GET /api/system/health` (SUPER_ADMIN only). */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: number;
  database: { status: 'connected' | 'disconnected' };
  redis: RedisHealthMetrics | null;
  rateLimiter: { storage: string; fallbackCount: number };
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const response = await api.get<SystemHealth>(API_ROUTES.SYSTEM_HEALTH);
  return response.data;
}
