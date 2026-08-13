import { Injectable } from '@nestjs/common';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

import type { WorkspaceRuntimeOptions } from './workspace-context.adapter';
import type { ResolvedWorkspace } from './workspace-resolver';
import { WorkspaceRuntimeService } from './workspace-runtime.service';


@Injectable()
export class WorkspaceRuntimeContext {
  constructor(private readonly runtime: WorkspaceRuntimeService) {}

  get(
    user: CurrentUserPayload,
    options: WorkspaceRuntimeOptions = {},
  ): ResolvedWorkspace {
    return this.runtime.resolve(user, options);
  }
}