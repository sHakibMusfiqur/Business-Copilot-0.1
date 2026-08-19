import {
  Controller, Get, Post, Patch, Param, Body, Req, Res, Inject,
  HttpCode, HttpStatus, UseGuards, Sse, MessageEvent, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Observable, map } from 'rxjs';
import { Public } from '../common/decorators/public.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { ParseEmailParamPipe } from '../common/pipes/parse-email-param.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { THROTTLE } from '../common/throttle/throttle.config';
import { OnboardingService } from './onboarding.service';
import { ProvisioningEngineService } from './provisioning/provisioning-engine.service';
import { ProvisioningProgressService } from './provisioning/provisioning-progress.service';
import { PROVISION_EVENT_BUS, type ProvisionEventBus, type ProvisioningEvent } from './provisioning/provision-event-bus.interface';
import { OnboardingChecklistService } from './services/onboarding-checklist.service';
import { IdempotencyGuard } from './guards/idempotency.guard';
import { OnboardingSessionGuard } from './guards/onboarding-session.guard';
import { Idempotent } from './decorators/idempotent.decorator';
import { IdempotencyService } from './services/idempotency.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ProvisionSessionDto } from './dto/provision-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CompleteStepDto } from './dto/complete-step.dto';
import { SessionResponseDto } from './dto/session-response.dto';

@ApiTags('Onboarding')
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

  @Public()
  @Get('industries')
  @ApiOperation({ summary: 'Get all available industries' })
  async getIndustries() {
    return this.onboardingService.getIndustries();
  }

  @Public()
  @Throttle({ short: THROTTLE.veryStrict })
  @Post('sessions')
  @ApiOperation({ summary: 'Create a new onboarding session' })
  @ApiBody({ type: CreateSessionDto })
  @ApiCreatedResponse({ type: SessionResponseDto })
  async createSession(@Body() dto: CreateSessionDto) {
    return this.onboardingService.createSession(dto);
  }

  @UseGuards(OnboardingSessionGuard)
  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get onboarding session by ID' })
  @ApiOkResponse({ type: SessionResponseDto })
  async getSession(@Param('id', ParseCuidPipe) id: string) {
    return this.onboardingService.getSession(id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ short: THROTTLE.strict })
  @Get('by-email/:email')
  @ApiOperation({ summary: 'Get the authenticated user\'s active onboarding session' })
  @ApiOkResponse({ type: SessionResponseDto })
  async getSessionByEmail(
    @Param('email', ParseEmailParamPipe) email: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (user.email.toLowerCase() !== email.toLowerCase()) {
      throw new ForbiddenException('You can only resume your own onboarding session');
    }
    return this.onboardingService.getSessionByEmail(email);
  }

  @UseGuards(OnboardingSessionGuard)
  @Patch('sessions/:id')
  @ApiOperation({ summary: 'Update onboarding session' })
  @ApiBody({ type: UpdateSessionDto })
  @ApiOkResponse({ type: SessionResponseDto })
  async updateSession(@Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateSessionDto, @Req() req: Request) {
    const caller = (req as Request & { user?: { id?: string } }).user;
    return this.onboardingService.updateSession(id, dto, caller?.id ?? null);
  }

  @UseGuards(OnboardingSessionGuard)
  @Post('sessions/:id/complete-step')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a step as completed' })
  @ApiBody({ type: CompleteStepDto })
  @ApiOkResponse({ type: SessionResponseDto })
  async completeStep(@Param('id', ParseCuidPipe) id: string, @Body() dto: CompleteStepDto) {
    return this.onboardingService.completeStep(id, dto.step);
  }

  @UseGuards(OnboardingSessionGuard)
  @Get('sessions/:id/preview')
  @ApiOperation({ summary: 'Preview provisioning configuration' })
  async getPreview(@Param('id', ParseCuidPipe) id: string) {
    return this.onboardingService.getProvisioningPreview(id);
  }

  @UseGuards(OnboardingSessionGuard)
  @Throttle({ long: THROTTLE.veryStrict })
  @UseGuards(IdempotencyGuard)
  @Idempotent()
  @Post('sessions/:id/provision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Provision the organization' })
  @ApiOkResponse({ type: SessionResponseDto })
  async provision(
    @Param('id', ParseCuidPipe) id: string,
    @Body() body: ProvisionSessionDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.provisioningEngine.provision(id, body);
    const request = res.req as { idempotencyKey?: string };
    if (request?.idempotencyKey) {
      await this.idempotencyService.cacheResponse(request.idempotencyKey, result);
    }
    return result;
  }

  @UseGuards(OnboardingSessionGuard)
  @Get('sessions/:id/progress')
  @ApiOperation({ summary: 'Get provisioning progress' })
  async getProgress(@Param('id', ParseCuidPipe) id: string) {
    return this.progressService.getProgress(id);
  }

  @UseGuards(OnboardingSessionGuard)
  @Get('sessions/:id/sse-token')
  @ApiOperation({ summary: 'Issue a short-lived SSE credential for the provisioning progress stream' })
  async getSseToken(@Param('id', ParseCuidPipe) id: string, @Req() req: Request) {
    const caller = (req as Request & { user?: { id?: string } }).user;
    return this.onboardingService.issueSseToken(id, caller?.id ?? null);
  }

  @UseGuards(OnboardingSessionGuard)
  @Get('sessions/:id/progress/stream')
  @Sse()
  @ApiOperation({ summary: 'SSE stream for provisioning progress' })
  streamProgress(@Param('id', ParseCuidPipe) id: string): Observable<MessageEvent> {
    return this.eventBus.getStream(id).pipe(
      map((event: ProvisioningEvent) => ({
        type: 'provisioning',
        data: JSON.stringify(event.data),
      })),
    );
  }

  @UseGuards(OnboardingSessionGuard)
  @Get('sessions/:id/checklist')
  @ApiOperation({ summary: 'Get onboarding checklist' })
  async getChecklist(@Param('id', ParseCuidPipe) id: string) {
    return this.checklistService.getChecklist(id);
  }

  @UseGuards(OnboardingSessionGuard)
  @Post('sessions/:id/checklist/:itemId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark checklist item as complete' })
  async markChecklistComplete(
    @Param('id', ParseCuidPipe) id: string,
    @Param('itemId', ParseCuidPipe) itemId: string,
  ) {
    return this.checklistService.markComplete(id, itemId);
  }

  @UseGuards(OnboardingSessionGuard)
  @Post('sessions/:id/checklist/:itemId/incomplete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark checklist item as incomplete' })
  async markChecklistIncomplete(
    @Param('id', ParseCuidPipe) id: string,
    @Param('itemId', ParseCuidPipe) itemId: string,
  ) {
    return this.checklistService.markIncomplete(id, itemId);
  }

  @UseGuards(OnboardingSessionGuard)
  @Post('sessions/:id/checklist/:itemId/skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Skip a checklist item' })
  async skipChecklistItem(
    @Param('id', ParseCuidPipe) id: string,
    @Param('itemId', ParseCuidPipe) itemId: string,
  ) {
    return this.checklistService.skipItem(id, itemId);
  }

  @UseGuards(OnboardingSessionGuard)
  @Get('sessions/:id/checklist/progress')
  @ApiOperation({ summary: 'Get checklist progress' })
  async getChecklistProgress(@Param('id', ParseCuidPipe) id: string) {
    return this.checklistService.getProgress(id);
  }
}
