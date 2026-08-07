import type { LucideIcon } from 'lucide-react';

import type {
  CapabilityKey,
  IndustryKey,
  ModuleStatus,
  ModuleVisibility,
} from '@/core/types';

/** Sidebar category a module belongs to. */
export type ModuleCategory =
  | 'Workspace'
  | 'Relations'
  | 'Operations'
  | 'Finance'
  | 'People'
  | 'Administration'
  | 'Analytics';

/** Typed settings a module can declare; consumed by future engines. */
export interface ModuleSettings {
  order?: number;
  standalone?: boolean;
  quickAccess?: boolean;
}

export interface ModuleManifest {
  id: string;
  name: string;
  description?: string;
  icon: LucideIcon;
  category: ModuleCategory;
  route: string;
  permissions: string[];
  capabilities: CapabilityKey[];
  settings?: ModuleSettings;
  status: ModuleStatus;
  visibility?: ModuleVisibility;
  dependencies?: string[];
  industries?: IndustryKey[];
}

/** Runtime lifecycle status of a module instance within the Module Engine. */
export type ModuleLifecycleStatus =
  | 'registered'
  | 'resolving'
  | 'loaded'
  | 'starting'
  | 'active'
  | 'stopping'
  | 'stopped'
  | 'failed';

/** Lazy factory that yields a module's runtime controller on first load. */
export type ModuleControllerFactory = (context: ModuleRuntimeContext) => ModuleController;

/** Runtime context passed to a module controller. */
export interface ModuleRuntimeContext {
  readonly moduleId: string;
  readonly moduleName: string;
}

/** Lifecycle hooks a module controller may implement. */
export interface ModuleController {
  initialize?: (context: ModuleRuntimeContext) => void | Promise<void>;
  start?: (context: ModuleRuntimeContext) => void | Promise<void>;
  stop?: (context: ModuleRuntimeContext) => void | Promise<void>;
  /** Reinitialize the module after its manifest or config changes. */
  reload?: (context: ModuleRuntimeContext) => void | Promise<void>;
  /** Readiness probe; throws or resolves false when not ready. */
  health?: (context: ModuleRuntimeContext) => boolean | Promise<boolean>;
}

/** Health of a running module instance. */
export interface ModuleHealth {
  readonly moduleId: string;
  readonly status: ModuleLifecycleStatus;
  readonly ok: boolean;
  readonly message?: string;
  readonly depsResolved: string[];
  readonly missingDeps: string[];
  readonly startedAt?: string;
}

/** Snapshot of the module engine. */
export interface ModuleRuntimeSnapshot {
  readonly moduleCount: number;
  readonly activeCount: number;
  readonly failedCount: number;
  readonly modules: ModuleHealth[];
}
