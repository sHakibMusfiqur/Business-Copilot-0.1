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

import { PurchaseService } from './purchase.service';
import { QueryPurchaseDto } from './dto/query-purchase.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { ReceivePurchaseDto } from './dto/receive-purchase.dto';

@ApiTags('Purchase')
@Controller('purchase')
@UseGuards(JwtAuthGuard)
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions(['purchase.read'])
  @ApiBearerAuth('access-token')
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryPurchaseDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.purchaseService.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['purchase.read'])
  @ApiBearerAuth('access-token')
  async findById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.purchaseService.findById(orgId, id);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions(['purchase.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePurchaseDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.purchaseService.create(orgId, user.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['purchase.update'])
  @ApiBearerAuth('access-token')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.purchaseService.update(orgId, user.id, id, dto);
  }

  @Post(':id/submit')
  @UseGuards(PermissionGuard)
  @Permissions(['purchase.update'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  async submit(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.purchaseService.submit(orgId, user.id, id);
  }

  @Post(':id/approve')
  @UseGuards(PermissionGuard)
  @Permissions(['purchase.approve'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  async approve(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.purchaseService.approve(orgId, user.id, id);
  }

  @Post(':id/receive')
  @UseGuards(PermissionGuard)
  @Permissions(['purchase.receive'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  async receive(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.purchaseService.receive(orgId, user.id, id, dto.notes);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['purchase.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.purchaseService.softDelete(orgId, user.id, id);
  }
}
