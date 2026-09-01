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

import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

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
  @ApiOperation({ summary: 'List employees in the organization' })
  @ApiOkResponse({ description: 'Employees listed successfully' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, email, or employee code' })
  @ApiQuery({ name: 'departmentId', required: false, description: 'Filter by department ID' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.employeesService.findAll(orgId, {
      search,
      departmentId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get('stats')
  @UseGuards(PermissionGuard)
  @Permissions(['employees.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get employee statistics' })
  @ApiOkResponse({ description: 'Employee statistics' })
  async getStats(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.employeesService.getStats(orgId);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['employees.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get employee details' })
  @ApiOkResponse({ description: 'Employee details' })
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) employeeId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.employeesService.findOne(orgId, employeeId);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions(['employees.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiCreatedResponse({ description: 'Employee created' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateEmployeeDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.employeesService.create(orgId, user.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['employees.update'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an employee' })
  @ApiOkResponse({ description: 'Employee updated' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) employeeId: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.employeesService.update(orgId, user.id, employeeId, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['employees.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete an employee' })
  @ApiOkResponse({ description: 'Employee deleted' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) employeeId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.employeesService.remove(orgId, user.id, employeeId);
  }
}
