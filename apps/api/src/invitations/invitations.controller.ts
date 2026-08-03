import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@ApiTags('Invitations')
@Controller('invitations')
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions(['users.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ description: 'Invitation created and email queued' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateInvitationDto,
    @Req() req: Request,
  ) {
    const orgId = this.requireOrg(user);
    return this.invitationsService.create(orgId, user.id, dto, req.ip, req.headers['user-agent']);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions(['users.read'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Pending invitations for the organization' })
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.invitationsService.findAll(orgId);
  }

  @Post(':id/resend')
  @UseGuards(PermissionGuard)
  @Permissions(['users.create'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Invitation email resent' })
  async resend(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') invitationId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.invitationsService.resend(orgId, invitationId, user.id);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['users.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Invitation revoked' })
  async revoke(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') invitationId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.invitationsService.revoke(orgId, invitationId, user.id);
  }

  @Get('verify')
  @Public()
  @ApiOkResponse({ description: 'Invitation token verified' })
  @ApiBadRequestResponse({ description: 'Invalid or expired invitation' })
  async verify(@Query('token') token: string) {
    return this.invitationsService.verify(token);
  }

  @Post('accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Invitation accepted, account created' })
  @ApiBadRequestResponse({ description: 'Invalid or expired invitation' })
  async accept(
    @Body() dto: AcceptInvitationDto,
    @Req() req: Request,
  ) {
    return this.invitationsService.accept(dto.token, dto, req.ip, req.headers['user-agent']);
  }
}
