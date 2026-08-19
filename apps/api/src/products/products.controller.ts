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
  @ApiOperation({ summary: 'List products for the organization' })
  @ApiOkResponse({ description: 'Paginated list of products' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
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
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiOkResponse({ description: 'Product details' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async findById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.productsService.findById(orgId, id);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions(['products.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiCreatedResponse({ description: 'Product created successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
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
  @ApiOperation({ summary: 'Update a product' })
  @ApiOkResponse({ description: 'Product updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
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
  @ApiOperation({ summary: 'Soft delete a product' })
  @ApiOkResponse({ description: 'Product deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.productsService.softDelete(orgId, user.id, id);
  }

  @Patch(':id/status')
  @UseGuards(PermissionGuard)
  @Permissions(['products.update'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Activate or deactivate a product' })
  @ApiOkResponse({ description: 'Product status updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.productsService.updateStatus(orgId, user.id, id, dto);
  }
}
