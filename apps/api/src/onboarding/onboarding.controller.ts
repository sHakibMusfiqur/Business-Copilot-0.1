import {
  Controller, Get, Post, Patch, Param, Body, Res, Inject,
  HttpCode, HttpStatus, UseGuards, Sse, MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { Public } from '../common/decorators/public.decorator';
import { OnboardingService } from './onboarding.service';
import { ProvisioningEngineService } from './provisioning/provisioning-engine.service';
import { ProvisioningProgressService } from './provisioning/provisioning-progress.service';
import { PROVISION_EVENT_BUS, type ProvisionEventBus, type ProvisioningEvent } from './provisioning/provision-event-bus.interface';
import { OnboardingChecklistService } from './services/onboarding-checklist.service';
import { IdempotencyGuard } from './guards/idempotency.guard';
import { Idempotent } from './decorators/idempotent.decorator';
import { IdempotencyService } from './services/idempotency.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CompleteStepDto } from './dto/complete-step.dto';
import { SessionResponseDto } from './dto/session-response.dto';

@ApiTags('Onboarding')
@Public()
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly provisioningEngine: ProvisioningEngineService,
    private readonly progressService: ProvisioningProgressService,
    @Inject(PROVISION_EVENT_BUS) private readonly eventBus: ProvisionEventBus,
    private readonly checklistService: OnboardingChecklistService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Get('industries')
  @ApiOperation({ summary: 'Get all available industries' })
  async getIndustries() {
    return this.onboardingService.getIndustries();
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new onboarding session' })
  @ApiBody({ type: CreateSessionDto })
  @ApiCreatedResponse({ type: SessionResponseDto })
  async createSession(@Body() dto: CreateSessionDto) {
    return this.onboardingService.createSession(dto);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get onboarding session by ID' })
  @ApiOkResponse({ type: SessionResponseDto })
  async getSession(@Param('id') id: string) {
    return this.onboardingService.getSession(id);
  }

  @Get('by-email/:email')
  @ApiOperation({ summary: 'Get active onboarding session by email' })
  @ApiOkResponse({ type: SessionResponseDto })
  async getSessionByEmail(@Param('email') email: string) {
    return this.onboardingService.getSessionByEmail(email);
  }

  @Patch('sessions/:id')
  @ApiOperation({ summary: 'Update onboarding session' })
  @ApiBody({ type: UpdateSessionDto })
  @ApiOkResponse({ type: SessionResponseDto })
  async updateSession(@Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.onboardingService.updateSession(id, dto);
  }

  @Post('sessions/:id/complete-step')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a step as completed' })
  @ApiBody({ type: CompleteStepDto })
  @ApiOkResponse({ type: SessionResponseDto })
  async completeStep(@Param('id') id: string, @Body() dto: CompleteStepDto) {
    return this.onboardingService.completeStep(id, dto.step);
  }

  @Get('sessions/:id/preview')
  @ApiOperation({ summary: 'Preview provisioning configuration' })
  async getPreview(@Param('id') id: string) {
    return this.onboardingService.getProvisioningPreview(id);
  }

  @Throttle({ long: { limit: 5, ttl: 60000 } })
  @UseGuards(IdempotencyGuard)
  @Idempotent()
  @Post('sessions/:id/provision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Provision the organization' })
  @ApiOkResponse({ type: SessionResponseDto })
  async provision(
    @Param('id') id: string,
    @Body() body: { selectedIndustry?: string | null; orgName?: string | null },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.provisioningEngine.provision(id, body);
    const request = res.req as { idempotencyKey?: string };
    if (request?.idempotencyKey) {
      await this.idempotencyService.cacheResponse(request.idempotencyKey, result);
    }
    return result;
  }

  @Get('sessions/:id/progress')
  @ApiOperation({ summary: 'Get provisioning progress' })
  async getProgress(@Param('id') id: string) {
    return this.progressService.getProgress(id);
  }

  @Get('sessions/:id/progress/stream')
  @Sse()
  @ApiOperation({ summary: 'SSE stream for provisioning progress' })
  streamProgress(@Param('id') id: string): Observable<MessageEvent> {
    return this.eventBus.getStream(id).pipe(
      map((event: ProvisioningEvent) => ({
        type: 'provisioning',
        data: JSON.stringify(event.data),
      })),
    );
  }

  @Get('sessions/:id/checklist')
  @ApiOperation({ summary: 'Get onboarding checklist' })
  async getChecklist(@Param('id') id: string) {
    return this.checklistService.getChecklist(id);
  }

  @Post('sessions/:id/checklist/:itemId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark checklist item as complete' })
  async markChecklistComplete(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.checklistService.markComplete(id, itemId);
  }

  @Post('sessions/:id/checklist/:itemId/incomplete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark checklist item as incomplete' })
  async markChecklistIncomplete(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.checklistService.markIncomplete(id, itemId);
  }

  @Post('sessions/:id/checklist/:itemId/skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Skip a checklist item' })
  async skipChecklistItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.checklistService.skipItem(id, itemId);
  }

  @Get('sessions/:id/checklist/progress')
  @ApiOperation({ summary: 'Get checklist progress' })
  async getChecklistProgress(@Param('id') id: string) {
    return this.checklistService.getProgress(id);
  }
}
