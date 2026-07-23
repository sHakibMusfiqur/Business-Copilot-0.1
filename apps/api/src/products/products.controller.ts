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

import { ProductsService } from './products.service';
import { QueryProductsDto } from './dto/query-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions(['products.read'])
  @ApiBearerAuth('access-token')
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryProductsDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.productsService.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['products.read'])
  @ApiBearerAuth('access-token')
  async findById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.productsService.findById(orgId, id);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions(['products.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProductDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.productsService.create(orgId, user.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['products.update'])
  @ApiBearerAuth('access-token')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.productsService.update(orgId, user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['products.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.productsService.softDelete(orgId, user.id, id);
  }

  @Patch(':id/status')
  @UseGuards(PermissionGuard)
  @Permissions(['products.update'])
  @ApiBearerAuth('access-token')
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.productsService.updateStatus(orgId, user.id, id, dto);
  }
}
