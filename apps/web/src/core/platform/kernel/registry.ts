import type {
  EngineHealth,
  EngineKind,
  EngineRecord,
  EngineRegistrationInput,
  EngineStatus,
} from './types';

function createInitialHealth(): EngineHealth {
  return { status: 'unknown', checkedAt: new Date().toISOString() };
}

export class EngineRegistry {
  private readonly records = new Map<string, EngineRecord<object>>();

  register(input: EngineRegistrationInput): boolean {
    if (this.records.has(input.id)) return false;
    if (typeof input.implementation !== 'object' && typeof input.implementation !== 'function') {
      return false;
    }
    this.records.set(input.id, {
      id: input.id,
      name: input.name,
      description: input.description,
      version: input.version,
      kind: input.kind,
      dependencies: input.dependencies,
      status: 'registered',
      health: createInitialHealth(),
      implementation: input.implementation as object,
    });
    return true;
  }

  get<T extends object>(id: string): EngineRecord<T> | undefined {
    return this.records.get(id) as EngineRecord<T> | undefined;
  }

  has(id: string): boolean {
    return this.records.has(id);
  }

  list(): EngineRecord<object>[] {
    return Array.from(this.records.values());
  }

  byKind(kind: EngineKind): EngineRecord<object>[] {
    return this.list().filter((record) => record.kind === kind);
  }

  setStatus(id: string, status: EngineStatus, health?: EngineHealth): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.status = status;
    if (health) record.health = health;
    return true;
  }

  updateHealth(id: string, health: EngineHealth): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.health = health;
    return true;
  }
}
