import type {
  Command,
  CommandDefinition,
  CommandHandler,
  CommandLogger,
  CommandMiddleware,
  CommandRegistrySnapshot,
  CommandResult,
  CommandValidator,
} from './types';

export class CommandBus {
  private readonly handlers = new Map<string, CommandHandler<Command>>();
  private readonly validators = new Map<string, CommandValidator<Command>>();
  private readonly middleware: CommandMiddleware[] = [];
  private logger?: CommandLogger;

  /** Register a command handler. Returns false when the type is already bound. */
  register<C extends Command>(definition: CommandDefinition<C>): boolean {
    if (this.handlers.has(definition.type)) return false;
    this.handlers.set(definition.type, definition.handler as CommandHandler<Command>);
    return true;
  }

  /** Register a validator for a command type. Overwrites an existing validator. */
  validate<C extends Command>(type: C['type'], validator: CommandValidator<C>): this {
    this.validators.set(type, validator as CommandValidator<Command>);
    return this;
  }

  /** Append middleware to the pipeline (runs in registration order). */
  use(middleware: CommandMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }

  /** Attach a logging hook for command lifecycle events. */
  onLog(logger: CommandLogger): this {
    this.logger = logger;
    return this;
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  /** Execute a command through validation + middleware + handler. */
  async execute(command: Command): Promise<CommandResult> {
    const startedAt = Date.now();
    const finish = (outcome: CommandResult['outcome'], error?: Error): CommandResult => {
      const result: CommandResult = { outcome, error, elapsedMs: Date.now() - startedAt };
      return result;
    };

    this.logger?.({ direction: 'incoming', command });

    const handler = this.handlers.get(command.type);
    if (!handler) {
      this.logger?.({ direction: 'failed', command, error: new Error(`Command handler not registered: ${command.type}`) });
      return finish('failure', new Error(`Command handler not registered: ${command.type}`));
    }

    const validator = this.validators.get(command.type);
    const issues = validator ? validator(command) : [];
    if (issues.length > 0) {
      const error = new Error(`Command validation failed for "${command.type}": ${issues.join('; ')}`);
      this.logger?.({ direction: 'failed', command, error });
      return finish('failure', error);
    }

    this.logger?.({ direction: 'executing', command });
    try {
      const run = (index: number): Promise<void> => {
        const layer = this.middleware[index];
        if (!layer) {
          this.logger?.({ direction: 'executing', command });
          return Promise.resolve(handler(command));
        }
        return layer(command, () => run(index + 1));
      };
      await run(0);
      this.logger?.({ direction: 'completed', command });
      return finish('success');
    } catch (error) {
      this.logger?.({ direction: 'failed', command, error });
      return finish('failure', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** Snapshot of the registry for observability and debugging. */
  snapshot(): CommandRegistrySnapshot {
    return {
      commandCount: this.handlers.size,
      middlewareCount: this.middleware.length,
      types: [...this.handlers.keys()],
    };
  }
}

/** Create a new command bus. */
export function createCommandBus(): CommandBus {
  return new CommandBus();
}