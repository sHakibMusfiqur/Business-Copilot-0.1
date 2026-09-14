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
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags, ApiOperation } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

import { PayrollService } from './payroll.service';
import { CreatePayrollDto, UpdatePayrollDto } from './dto/create-payroll.dto';
import { MarkAsPaidDto } from './dto/mark-as-paid.dto';
import { QueryPayrollDto } from './dto/query-payroll.dto';

@ApiTags('Payroll')
@Controller('payroll')
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions(['payroll.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List payroll records' })
  @ApiOkResponse({ description: 'Payroll records listed' })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryPayrollDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.payrollService.findAll(orgId, query);
  }

  @Get('stats')
  @UseGuards(PermissionGuard)
  @Permissions(['payroll.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get payroll statistics' })
  @ApiOkResponse({ description: 'Payroll statistics' })
  async getStats(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.payrollService.getStats(orgId);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['payroll.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get payroll record details' })
  @ApiOkResponse({ description: 'Payroll record details' })
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) payrollId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.payrollService.findOne(orgId, payrollId);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions(['payroll.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a payroll record' })
  @ApiCreatedResponse({ description: 'Payroll record created' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePayrollDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.payrollService.create(orgId, user.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['payroll.update'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a payroll record' })
  @ApiOkResponse({ description: 'Payroll record updated' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) payrollId: string,
    @Body() dto: UpdatePayrollDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.payrollService.update(orgId, user.id, payrollId, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['payroll.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a payroll record' })
  @ApiOkResponse({ description: 'Payroll record deleted' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) payrollId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.payrollService.remove(orgId, user.id, payrollId);
  }

  @Post(':id/submit')
  @UseGuards(PermissionGuard)
  @Permissions(['payroll.update'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit payroll for approval' })
  @ApiOkResponse({ description: 'Payroll submitted' })
  async submit(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) payrollId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.payrollService.submit(orgId, user.id, payrollId);
  }

  @Post(':id/approve')
  @UseGuards(PermissionGuard)
  @Permissions(['payroll.approve'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Approve pending payroll' })
  @ApiOkResponse({ description: 'Payroll approved' })
  async approve(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) payrollId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.payrollService.approve(orgId, user.id, payrollId);
  }

  @Post(':id/reject')
  @UseGuards(PermissionGuard)
  @Permissions(['payroll.reject'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reject pending payroll' })
  @ApiOkResponse({ description: 'Payroll rejected' })
  async reject(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) payrollId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.payrollService.reject(orgId, user.id, payrollId);
  }

  @Post(':id/pay')
  @UseGuards(PermissionGuard)
  @Permissions(['payroll.update'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mark approved payroll as paid' })
  @ApiOkResponse({ description: 'Payroll marked as paid' })
  async markAsPaid(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) payrollId: string,
    @Body() dto: MarkAsPaidDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.payrollService.markAsPaid(orgId, user.id, payrollId, dto);
  }
}
