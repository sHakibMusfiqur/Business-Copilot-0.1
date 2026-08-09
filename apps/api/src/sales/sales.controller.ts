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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

import { SalesService } from './sales.service';
import { QuerySaleDto } from './dto/query-sale.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { DeliverSaleDto } from './dto/deliver-sale.dto';

@ApiTags('Sales')
@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions(['sales.read'])
  @ApiBearerAuth('access-token')
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QuerySaleDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.salesService.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['sales.read'])
  @ApiBearerAuth('access-token')
  async findById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.salesService.findById(orgId, id);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions(['sales.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSaleDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.salesService.create(orgId, user.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['sales.update'])
  @ApiBearerAuth('access-token')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.salesService.update(orgId, user.id, id, dto);
  }

  @Post(':id/submit')
  @UseGuards(PermissionGuard)
  @Permissions(['sales.update'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  async submit(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.salesService.submit(orgId, user.id, id);
  }

  @Post(':id/confirm')
  @UseGuards(PermissionGuard)
  @Permissions(['sales.approve'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  async confirm(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.salesService.confirm(orgId, user.id, id);
  }

  @Post(':id/deliver')
  @UseGuards(PermissionGuard)
  @Permissions(['sales.deliver'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  async deliver(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: DeliverSaleDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.salesService.deliver(orgId, user.id, id, dto.notes);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['sales.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.salesService.softDelete(orgId, user.id, id);
  }
}
