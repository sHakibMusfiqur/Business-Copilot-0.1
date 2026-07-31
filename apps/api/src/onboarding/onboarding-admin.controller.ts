import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OnboardingAdminService } from './services/onboarding-admin.service';
import { EventBusFactory } from './provisioning/event-bus-factory.service';
import { DispatcherFactory } from './provisioning/dispatcher-factory.service';

@ApiTags('Onboarding Admin')
@Controller('admin/onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@ApiBearerAuth('access-token')
export class OnboardingAdminController {
  constructor(
    private readonly adminService: OnboardingAdminService,
    private readonly eventBusFactory: EventBusFactory,
    private readonly dispatcherFactory: DispatcherFactory,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get onboarding admin dashboard' })
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('event-bus')
  @ApiOperation({ summary: 'List available event bus providers' })
  async getEventBusProviders() {
    return { availableTypes: this.eventBusFactory.getAvailableTypes() };
  }

  @Get('dispatchers')
  @ApiOperation({ summary: 'List available dispatcher providers' })
  async getDispatcherProviders() {
    return { availableTypes: this.dispatcherFactory.getAvailableTypes() };
  }
}
