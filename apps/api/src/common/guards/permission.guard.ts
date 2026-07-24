import { Injectable, ForbiddenException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { PermissionRequirement } from '../decorators/permissions.decorator';
import { RbacService } from '../../rbac/rbac.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requirement || requirement.permissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: { id: string; organizationId?: string } }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }

    const { permissions, mode } = requirement;

    let hasPermission: boolean;

    if (mode === 'AND') {
      hasPermission = await this.rbacService.userHasAllPermissions(user.id, user.organizationId, permissions);
    } else {
      hasPermission = await this.rbacService.userHasAnyPermission(user.id, user.organizationId, permissions);
    }

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
