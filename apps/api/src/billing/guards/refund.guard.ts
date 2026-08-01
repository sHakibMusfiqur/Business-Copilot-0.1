import { Injectable, ForbiddenException, type CanActivate, type ExecutionContext } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../../rbac/rbac.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

/**
 * Restricts refund creation to privileged users only:
 *  - platform Super Admins,
 *  - the Organization Owner,
 *  - any user holding the `billing.manage` permission (e.g. a Billing Admin).
 *
 * Everyone else receives HTTP 403.
 */
@Injectable()
export class RefundGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: CurrentUserPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Platform Super Admin is always allowed.
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Organization Owner is always allowed.
    if (user.organizationId) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId: user.organizationId, userId: user.id },
        },
        select: { role: true },
      });
      if (membership?.role === 'OWNER') {
        return true;
      }
    }

    // Billing Admin (or any role carrying billing.manage).
    if (user.organizationId) {
      const hasBillingManage = await this.rbacService.userHasAnyPermission(
        user.id,
        user.organizationId,
        ['billing.manage'],
      );
      if (hasBillingManage) {
        return true;
      }
    }

    throw new ForbiddenException('Only an Organization Owner, Super Admin, or Billing Admin can create refunds');
  }
}
