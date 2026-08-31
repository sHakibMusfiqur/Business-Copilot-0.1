import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
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
import { importMulterOptions } from './file-upload.config';

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
  @UseInterceptors(FileInterceptor('file', importMulterOptions))
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'importType', 'fileFormat', 'delimiter', 'skipFirstRow', 'updateExisting'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'CSV, XLSX, or XLS file (max 50MB)' },
        importType: { type: 'string', enum: ['customers', 'products', 'suppliers', 'inventory', 'chart-of-accounts'] },
        fileFormat: { type: 'string', enum: ['CSV', 'XLSX', 'XLS'] },
        delimiter: { type: 'string', enum: ['Comma', 'Tab', 'Semicolon'] },
        skipFirstRow: { type: 'boolean' },
        updateExisting: { type: 'boolean' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Import job created and processing started' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async startImport(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('importType') importType: string,
    @Body('fileFormat') fileFormat: string,
    @Body('delimiter') delimiter: string,
    @Body('skipFirstRow') skipFirstRow: string,
    @Body('updateExisting') updateExisting: string,
  ) {
    const orgId = this.requireOrg(user);

    if (!file) {
      throw new ForbiddenException('No file uploaded');
    }

    return this.importService.startImport(orgId, user.id, {
      importType,
      fileFormat,
      delimiter,
      skipFirstRow: skipFirstRow === 'true' || skipFirstRow === '1',
      updateExisting: updateExisting === 'true' || updateExisting === '1',
      fileName: file.originalname,
      fileSize: file.size,
    }, file);
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
