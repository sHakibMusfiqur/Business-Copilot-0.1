/** Command Bus shared types. */

/** A command is a named intent carrying a payload; the type is the discriminator. */
export type Command = { readonly type: string } & Record<string, unknown>;

/** Result produced by executing a command. */
export interface CommandResult {
  readonly outcome: CommandOutcome;
  readonly error?: Error;
  /** Millis taken to run the command pipeline. */
  readonly elapsedMs: number;
}

export type CommandOutcome = 'success' | 'failure';

/** Handler for a command. May be async. */
export type CommandHandler<C extends Command> = (command: C) => void | Promise<void>;

/** Command definition: metadata plus the handler closure. */
export interface CommandDefinition<C extends Command> {
  readonly type: string;
  readonly handler: CommandHandler<C>;
  readonly description?: string;
}

/**
 * Middleware around command execution. `next()` continues the pipeline into the
 * handler; middleware may transform, validate or short-circuit.
 */
export type CommandMiddleware = (command: Command, next: () => Promise<void>) => Promise<void>;

/** Validator keyed to a command type; returns an array of validation issues. */
export type CommandValidator<C extends Command> = (command: C) => readonly string[];

/** Logging hook called around command execution. */
export interface CommandLogger {
  (event: { direction: 'incoming' | 'executing' | 'completed' | 'failed'; command: Command; error?: unknown }): void;
}

/** Immutable snapshot of the command registry. */
export interface CommandRegistrySnapshot {
  readonly commandCount: number;
  readonly middlewareCount: number;
  readonly types: readonly string[];
}