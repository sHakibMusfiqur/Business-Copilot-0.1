import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

import { InventoryService } from './inventory.service';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions(['inventory.read'])
  @ApiBearerAuth('access-token')
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryInventoryDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.inventoryService.findAll(orgId, query);
  }

  @Post('adjust')
  @UseGuards(PermissionGuard)
  @Permissions(['inventory.adjust'])
  @ApiBearerAuth('access-token')
  async adjust(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateStockAdjustmentDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.inventoryService.adjust(orgId, user.id, dto);
  }

  @Get('summary')
  @UseGuards(PermissionGuard)
  @Permissions(['inventory.read'])
  @ApiBearerAuth('access-token')
  async getSummary(
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const orgId = this.requireOrg(user);
    return this.inventoryService.getSummary(orgId);
  }

  @Get(':productId/history')
  @UseGuards(PermissionGuard)
  @Permissions(['inventory.read'])
  @ApiBearerAuth('access-token')
  async getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('productId') productId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.inventoryService.getHistory(orgId, productId);
  }
}
