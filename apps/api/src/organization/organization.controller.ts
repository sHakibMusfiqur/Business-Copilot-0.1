import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { LookupByEmailDto } from './dto/lookup-by-email.dto';

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateOrganizationDto })
  @ApiCreatedResponse({ description: 'Organization created successfully' })
  @ApiConflictResponse({ description: 'Organization name already exists' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: CurrentUserPayload,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { organization, userEmail, userRole } =
      await this.organizationService.create(dto, user.id);

    const tokens = await this.authService.generateTokens({
      id: user.id,
      email: userEmail ?? user.email,
      role: userRole ?? user.role,
      organizationId: organization.id,
    });

    response.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      organization,
      ...tokens,
    };
  }

  @Public()
  @Get('by-slug/:slug')
  @ApiOkResponse({ description: 'Organization branding resolved by slug' })
  @ApiNotFoundResponse({ description: 'Organization not found' })
  async getBySlug(@Param('slug') slug: string) {
    const org = await this.organizationService.findPublicBySlug(slug);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  @Public()
  @Post('by-email')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LookupByEmailDto })
  @ApiOkResponse({ description: 'Organization branding resolved by email address' })
  async getByEmail(@Body() dto: LookupByEmailDto) {
    const org = await this.organizationService.findPublicByEmail(dto.email);
    return org ? { found: true, organization: org } : { found: false };
  }
}
