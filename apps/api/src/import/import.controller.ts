import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';

import { ImportService } from './import.service';
import { StartImportDto } from './dto/start-import.dto';

@ApiTags('Import')
@Controller('import')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(['settings.manage'])
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ description: 'Import job created' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async startImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: StartImportDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.importService.startImport(orgId, user.id, dto);
  }

  @Get()
  @Permissions(['settings.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Import jobs retrieved' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  async getImportJobs(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.importService.getImportJobs(orgId);
  }

  @Get(':id')
  @Permissions(['settings.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Import job retrieved' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiNotFoundResponse({ description: 'Import job not found' })
  async getImportJob(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) jobId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.importService.getImportJob(orgId, jobId);
  }
}
