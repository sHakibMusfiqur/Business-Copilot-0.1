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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';

@ApiTags('Departments')
@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions(['users.read'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Active departments available to the organization' })
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.departmentsService.findAll(orgId);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions(['users.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ description: 'Department created' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateDepartmentDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.departmentsService.create(orgId, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['users.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Department deleted' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) departmentId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.departmentsService.remove(orgId, user.id, departmentId);
  }
}
