import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { HealthService } from './health.service';

@ApiTags('System')
@Controller('system')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Full system health check (SUPER_ADMIN only)' })
  async health() {
    return this.healthService.check();
  }
}
