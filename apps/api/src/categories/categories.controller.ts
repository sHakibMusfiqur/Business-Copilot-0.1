import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';

import { CategoriesService } from './categories.service';

@ApiTags('Categories')
@Controller('categories')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
  ) {}

  @Get()
  @Permissions(['products.read'])
  @ApiBearerAuth('access-token')
  async findAll() {
    return this.categoriesService.findAll();
  }
}
