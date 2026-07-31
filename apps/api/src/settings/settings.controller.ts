import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Post,
  Put,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';

import { BrandingSettingsDto } from './dto/branding-settings.dto';
import { TaxSettingsDto } from './dto/tax-settings.dto';
import { EmailSettingsDto } from './dto/email-settings.dto';
import { BillingSettingsDto } from './dto/billing-settings.dto';
import { PreferencesSettingsDto } from './dto/preferences-settings.dto';
import { NotificationsSettingsDto } from './dto/notifications-settings.dto';
import { settingsMulterOptions } from './file-upload.config';
import { SettingsService, type FileUploadInput } from './settings.service';

const VALID_NAMESPACES = new Set([
  'branding',
  'tax',
  'email',
  'billing',
  'preferences',
  'notifications',
]);

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(['settings.manage'])
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(private readonly settingsService: SettingsService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  private requireNamespace(namespace: string): string {
    if (!VALID_NAMESPACES.has(namespace)) {
      throw new BadRequestException(`Unknown settings namespace "${namespace}"`);
    }
    return namespace;
  }

  @Get(':namespace')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Settings for the namespace retrieved' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async get(@Param('namespace') namespace: string, @CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.settingsService.get(orgId, this.requireNamespace(namespace));
  }

  @Put('branding')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Branding settings updated' })
  @ApiBody({ type: BrandingSettingsDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async updateBranding(@Body() dto: BrandingSettingsDto, @CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.settingsService.upsert(orgId, 'branding', { ...dto });
  }

  @Put('tax')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Tax settings updated' })
  @ApiBody({ type: TaxSettingsDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async updateTax(@Body() dto: TaxSettingsDto, @CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.settingsService.upsert(orgId, 'tax', { ...dto });
  }

  @Put('email')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Email settings updated' })
  @ApiBody({ type: EmailSettingsDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async updateEmail(@Body() dto: EmailSettingsDto, @CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.settingsService.upsert(orgId, 'email', { ...dto });
  }

  @Put('billing')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Billing settings updated' })
  @ApiBody({ type: BillingSettingsDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async updateBilling(@Body() dto: BillingSettingsDto, @CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.settingsService.upsert(orgId, 'billing', { ...dto });
  }

  @Put('preferences')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Preferences updated' })
  @ApiBody({ type: PreferencesSettingsDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async updatePreferences(
    @Body() dto: PreferencesSettingsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const orgId = this.requireOrg(user);
    return this.settingsService.upsert(orgId, 'preferences', { ...dto });
  }

  @Put('notifications')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Notification settings updated' })
  @ApiBody({ type: NotificationsSettingsDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async updateNotifications(
    @Body() dto: NotificationsSettingsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const orgId = this.requireOrg(user);
    return this.settingsService.upsert(orgId, 'notifications', { ...dto });
  }

  @Post('files')
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ description: 'Files uploaded, URLs returned' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'favicon', maxCount: 1 },
      ],
      settingsMulterOptions,
    ),
  )
  async uploadFiles(
    @UploadedFiles() files: FileUploadInput,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const orgId = this.requireOrg(user);
    return this.settingsService.saveFiles(orgId, user.id, files);
  }
}
