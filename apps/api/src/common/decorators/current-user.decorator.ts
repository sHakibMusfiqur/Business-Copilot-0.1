import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

export interface CurrentUserPayload {
  id: string;
  email: string;
  organizationId?: string;
  tenantId?: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext): CurrentUserPayload | string => {
    const request = ctx.switchToHttp().getRequest<{ user: CurrentUserPayload }>();
    const user = request.user;
    return data ? user[data] as string : user;
  },
);
