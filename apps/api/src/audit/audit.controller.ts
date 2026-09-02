import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';

import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('access-token')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions(['audit.read'])
  @ApiOkResponse({ description: 'Paginated audit logs' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async findAll(
    @Query() query: AuditQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const isPlatformAdmin = user.role === 'SUPER_ADMIN';
    return this.auditService.findAll(query, user.organizationId, isPlatformAdmin, user.id);
  }

  @Get('actions')
  @Permissions(['audit.read'])
  @ApiOkResponse({ description: 'Distinct audit actions' })
  async getActions(@CurrentUser() user: CurrentUserPayload) {
    const isPlatformAdmin = user.role === 'SUPER_ADMIN';
    return this.auditService.getDistinctActions(user.organizationId, isPlatformAdmin, user.id);
  }

  @Get('export')
  @Permissions(['audit.read'])
  @ApiOkResponse({ description: 'CSV export of audit logs' })
  async exportCsv(
    @Query() query: AuditQueryDto,
    @CurrentUser() user: CurrentUserPayload,
    @Res() response: Response,
  ) {
    const isPlatformAdmin = user.role === 'SUPER_ADMIN';
    const csv = await this.auditService.exportCsv(query, user.organizationId, isPlatformAdmin, user.id);

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.csv"`,
    );
    response.send(csv);
  }
}
