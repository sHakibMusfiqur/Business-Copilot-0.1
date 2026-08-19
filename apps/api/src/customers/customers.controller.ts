import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

import { CustomersService } from './customers.service';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions(['customers.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List customers for the organization' })
  @ApiOkResponse({ description: 'Paginated list of customers' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryCustomersDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.customersService.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['customers.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a customer by ID' })
  @ApiOkResponse({ description: 'Customer details' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  async findById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) customerId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.customersService.findById(orgId, customerId);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions(['customers.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiCreatedResponse({ description: 'Customer created successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCustomerDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.customersService.create(orgId, user.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['customers.update'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a customer' })
  @ApiOkResponse({ description: 'Customer updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.customersService.update(orgId, user.id, customerId, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['customers.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft delete a customer' })
  @ApiOkResponse({ description: 'Customer deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) customerId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.customersService.softDelete(orgId, user.id, customerId);
  }

  @Patch(':id/status')
  @UseGuards(PermissionGuard)
  @Permissions(['customers.update'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Activate or deactivate a customer' })
  @ApiOkResponse({ description: 'Customer status updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  @ApiBadRequestResponse({ description: 'Cannot deactivate' })
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) customerId: string,
    @Body() dto: UpdateCustomerStatusDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.customersService.updateStatus(orgId, user.id, customerId, dto);
  }
}
