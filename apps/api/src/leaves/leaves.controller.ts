import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

import { LeavesService } from './leaves.service';
import { CreateLeaveDto, UpdateLeaveDto } from './dto/create-leave.dto';

@ApiTags('Leaves')
@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions(['employees.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List leave requests' })
  @ApiOkResponse({ description: 'Leave requests listed' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (max 100)' })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.leavesService.findAll(orgId, { employeeId, status, type, page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get('stats')
  @UseGuards(PermissionGuard)
  @Permissions(['employees.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get leave statistics' })
  @ApiOkResponse({ description: 'Leave statistics' })
  async getStats(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.leavesService.getStats(orgId);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['employees.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get leave details' })
  @ApiOkResponse({ description: 'Leave details' })
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) leaveId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.leavesService.findOne(orgId, leaveId);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions(['employees.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a leave request' })
  @ApiCreatedResponse({ description: 'Leave request created' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateLeaveDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.leavesService.create(orgId, user.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['employees.update'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a leave request' })
  @ApiOkResponse({ description: 'Leave request updated' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) leaveId: string,
    @Body() dto: UpdateLeaveDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.leavesService.update(orgId, user.id, leaveId, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['employees.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a leave request' })
  @ApiOkResponse({ description: 'Leave request deleted' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) leaveId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.leavesService.remove(orgId, user.id, leaveId);
  }

  @Post(':id/approve')
  @UseGuards(PermissionGuard)
  @Permissions(['employees.approve'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Approve a leave request' })
  @ApiOkResponse({ description: 'Leave request approved' })
  async approve(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) leaveId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.leavesService.approve(orgId, user.id, leaveId);
  }

  @Post(':id/reject')
  @UseGuards(PermissionGuard)
  @Permissions(['employees.reject'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reject a leave request' })
  @ApiOkResponse({ description: 'Leave request rejected' })
  async reject(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) leaveId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.leavesService.reject(orgId, user.id, leaveId);
  }
}
