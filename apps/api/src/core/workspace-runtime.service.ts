import { Injectable } from '@nestjs/common';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

import { ModuleRegistry } from './module-registry';
import {
  WorkspaceContextAdapter,
  type WorkspaceRuntimeOptions,
} from './workspace-context.adapter';
import {
  WorkspaceResolver,
  type ResolvedWorkspace,
} from './workspace-resolver';


@Injectable()
export class WorkspaceRuntimeService {
  constructor(
    private readonly adapter: WorkspaceContextAdapter,
    private readonly resolver: WorkspaceResolver,
    private readonly registry: ModuleRegistry,
  ) {}

  resolve(
    user: CurrentUserPayload,
    options: WorkspaceRuntimeOptions = {},
  ): ResolvedWorkspace {
    const context = this.adapter.create(user, options);
    const manifests = this.registry.list();
    return this.resolver.resolve(context, manifests);
  }
}