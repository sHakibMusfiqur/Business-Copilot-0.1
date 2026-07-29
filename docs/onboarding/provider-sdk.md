# Provider SDK — Industry Template Provider Guide

## Architecture

```
Business-Copilot Onboarding
│
├── OnboardingModule
│   ├── OnboardingService        — Session CRUD + OCC versioning
│   ├── ProvisioningEngineService — Entry point, dispatches provisioning
│   ├── ProvisioningOrchestratorService — Coordinates retry + checkpoint execution
│   ├── ProvisioningExecutorService — Executes 7 checkpoints sequentially
│   ├── ProvisioningProgressService — Tracks progress per session
│   ├── ProvisioningRetryService — Exponential backoff + transient error detection
│   ├── CompensationManager     — Rollback on provisioning failure
│   ├── EventBus (interface)     — Publish/subscribe for SSE events
│   ├── Dispatcher (interface)  — Pluggable execution strategy
│   └── Industry providers      — One class per industry (retail, manufacturing, etc.)
```

## Lifecycle Diagram

```
  validate()
     │
     ▼
  prepare()  ─── inside DB transaction ───
     │
     ▼
  provision() ─── inside DB transaction ───
     │
     ▼
  postProvision() ─── after commit, errors logged only
     │
     ▼
  cleanup()  ─── on failure, outside transaction
```

### Hook Timing

| Hook | Transaction | Failure Effect |
|------|-------------|----------------|
| `validate` | Outside | Aborts provisioning |
| `prepare` | Inside | Full DB rollback |
| `provision` | Inside | Full DB rollback |
| `postProvision` | After commit | Logged, provisioning continues |
| `cleanup` | Outside | Logged, provisioning is already failed |

## Provider Creation Guide

### 1. Create the provider class

```typescript
// industry-templates/providers/retail.provider.ts
import { Injectable } from '@nestjs/common';
import { BaseIndustryProvider } from '../base-industry-provider';
import type { ProvisioningContext } from '../industry-template-provider.interface';

@Injectable()
export class RetailProvider extends BaseIndustryProvider {
  readonly id = 'retail';

  protected readonly template = { /* ... */ };
  protected readonly provisioningConfig = { /* ... */ };

  async prepare(tx: any, context: ProvisioningContext): Promise<void> {
    // Allocate resources inside the transaction
  }

  async provision(tx: any, context: ProvisioningContext, orgId: string): Promise<void> {
    // Create industry-specific records
  }

  async postProvision(context: ProvisioningContext, orgId: string): Promise<void> {
    // Fire-and-forget side effects
  }
}
```

### 2. Register the provider

In `industry-templates/providers/index.ts`:

```typescript
import { RetailProvider } from './retail.provider';

export const INDUSTRY_PROVIDER_CLASSES = [
  RetailProvider,
  // ... other providers
];

export function createIndustryTemplateFactory() {
  return {
    provide: IndustryTemplateFactory,
    useFactory: (...providers: IndustryTemplateProvider[]) => {
      const factory = new IndustryTemplateFactory();
      for (const p of providers) {
        factory.register(p);
      }
      return factory;
    },
    inject: [/* list all provider classes */],
  };
}
```

## Extension Guide

### Adding a new checkpoint

1. Add to `CHECKPOINT_TASKS` in `provisioning-orchestrator.service.ts`
2. Add a new `do*` method in `provisioning-executor.service.ts`
3. Wire it into `executeCheckpoint()` in order

### Adding a new event bus backend

1. Implement `ProvisionEventBus` interface
2. Register in `EventBusFactory`
3. Configure via module options

### Adding a new dispatcher strategy

1. Implement `ProvisionDispatcher` interface
2. Register in `DispatcherFactory`
3. Configure via module options

## Best Practices

- Keep providers stateless — all state lives in the database
- Use `prepare()` for allocation and `provision()` for creation
- Never throw in `postProvision()` — errors are silently logged
- Always call `cleanup()` for any resources allocated in `validate()`
- Use the transaction (`tx`) parameter — never use `this.prisma` directly inside hooks
- Keep providers under 200 lines; extract shared logic into helper services

## Common Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Using `this.prisma` instead of `tx` | Operations NOT rolled back on failure | Always use the `tx` parameter |
| Throwing in `postProvision()` | Provisioning fails for non-critical side effects | Wrap in try/catch or handle in cleanup |
| Skipping `cleanup()` | Resource leaks on failed provisioning | Always implement cleanup for allocated resources |
| Mutating `context` | Cross-session data corruption | Treat context as read-only |
| Hardcoding industry IDs | Provider not found for matching templates | Use the same ID as the template |
