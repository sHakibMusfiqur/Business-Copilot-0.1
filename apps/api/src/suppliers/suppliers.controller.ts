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

import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

import { SuppliersService } from './suppliers.service';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { UpdateSupplierStatusDto } from './dto/update-supplier-status.dto';

@ApiTags('Suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions(['suppliers.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List suppliers for the organization' })
  @ApiOkResponse({ description: 'Paginated list of suppliers' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QuerySuppliersDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.suppliersService.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['suppliers.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a supplier by ID' })
  @ApiOkResponse({ description: 'Supplier details' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Supplier not found' })
  async findById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.suppliersService.findById(orgId, id);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions(['suppliers.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiCreatedResponse({ description: 'Supplier created successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSupplierDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.suppliersService.create(orgId, user.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['suppliers.update'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a supplier' })
  @ApiOkResponse({ description: 'Supplier updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Supplier not found' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.suppliersService.update(orgId, user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['suppliers.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft delete a supplier' })
  @ApiOkResponse({ description: 'Supplier deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Supplier not found' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.suppliersService.softDelete(orgId, user.id, id);
  }

  @Patch(':id/status')
  @UseGuards(PermissionGuard)
  @Permissions(['suppliers.update'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Activate or deactivate a supplier' })
  @ApiOkResponse({ description: 'Supplier status updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Supplier not found' })
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateSupplierStatusDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.suppliersService.updateStatus(orgId, user.id, id, dto);
  }
}
