import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { OnboardingAdminService } from './services/onboarding-admin.service';
import { EventBusFactory } from './provisioning/event-bus-factory.service';
import { DispatcherFactory } from './provisioning/dispatcher-factory.service';

@ApiTags('Onboarding Admin')
@Public()
@Controller('admin/onboarding')
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
