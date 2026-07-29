# Operations Guide — Onboarding System

## Deployment

### Prerequisites
- Node.js 24+
- PostgreSQL 16+
- npm 11.6.2+

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:4000` | API URL for frontend |
| `ONBOARDING_CLEANUP_CRON` | No | `0 0 * * *` | Cleanup schedule |
| `ONBOARDING_SESSION_TTL_MS` | No | `604800000` | Session expiry (7 days) |
| `IDEMPOTENCY_TTL_MS` | No | `86400000` | Idempotency record expiry (24h) |

### Steps

```bash
# 1. Install dependencies
cd apps/api
npm ci

# 2. Run migrations
npx prisma migrate deploy

# 3. Build
npm run build

# 4. Start
npm run start:prod
```

## Scaling

### Horizontal Scaling
- All provisioning logic is stateless (state in PostgreSQL)
- Database-backed idempotency works across instances
- Advisory locks in cleanup prevent duplicate execution
- SSE connections are per-instance; use Redis pub/sub for cross-instance event delivery

### Database
- `IdempotencyRecord` table: index on `key` (unique), `expiresAt`
- `OnboardingSession` table: index on `email`, `provisionStatus`
- `ChecklistItem` table: index on `sessionId`
- Estimated volume: ~1000 sessions/day, ~100MB/year

## Monitoring

### Key Metrics (via Admin API — `GET /admin/onboarding/dashboard`)

| Metric | Alert Threshold | Description |
|--------|----------------|-------------|
| `provision.failed` | > 5% of total | High failure rate |
| `metrics.activeSessions` | > 100 | Too many concurrent provisioning jobs |
| `provision.provisioningDurationMs.p95` | > 30000 | Slow provisioning |
| `retries.total` | > 10/hour | Excessive retries, possible infrastructure issue |
| `cleanup.status` | `never_run` | Cleanup job not executing |

### Health Check
Endpoint `GET /admin/onboarding/dashboard` returns `health.status`:
- `healthy`: Database responsive
- `degraded`: Slow response (>1s) or one dependency down
- `unhealthy`: Database unreachable

## Backup & Recovery

### Database
- Standard PostgreSQL backup (pg_dump/pg_restore)
- No application-level backup needed (all state in DB)

### Provision Failure Recovery
1. Admin views failed sessions via `GET /admin/onboarding/dashboard`
2. Failed sessions show `failedSessions` count with retry history
3. To retry a failed session, the client calls `POST /onboarding/sessions/:id/provision` with a new idempotency key
4. The executor resumes from the last failed checkpoint

### Disaster Recovery
1. Restore PostgreSQL from backup
2. Rebuild application from deployment artifacts
3. Run `npx prisma migrate deploy` to ensure schema is current
4. Start application; idempotency cache will repopulate on first request

## Cleanup Jobs

### Automated (scheduled)
- **Expired Sessions**: Removed after 30 days via `OnboardingCleanupService.cleanup()`
- **Idempotency Records**: Removed after TTL expiry via `IdempotencyService.cleanupExpired()`

### Manual (ad-hoc)
```bash
# Trigger cleanup immediately via admin endpoint (if implemented)
curl -X POST https://api.example.com/admin/onboarding/cleanup
```

## Upgrade Strategy

### Schema Migrations
1. Run `npx prisma migrate dev` to create migration
2. Apply with `npx prisma migrate deploy`
3. All migrations are backward-compatible (no destructive changes)

### Zero-Downtime Deployments
1. Deploy new instances alongside old ones
2. Database-backed idempotency ensures dual-instance safety
3. Old instances drain connections naturally
4. SSE connections on old instances complete before shutdown

## Troubleshooting

| Issue | Likely Cause | Resolution |
|-------|-------------|------------|
| Provisioning stuck at 0% | Deadlock or transaction timeout | Check `activeSessions` metric; restart failed sessions via API |
| High retry count | Database connection pool exhausted | Increase `max_connections` or connection pool size |
| Cleanup not running | `@nestjs/schedule` not initialized | Verify `ScheduleModule.forRoot()` is imported |
| Idempotency cache miss | Wrong key, expired record, key mismatch | Verify client sends the same key on retry |
| SSE events not received | Different instance serving SSE vs processing | Implement cross-instance event bus (Redis) via EventBusFactory |
