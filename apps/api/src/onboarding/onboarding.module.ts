import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingSessionGuard } from './guards/onboarding-session.guard';
import { ProvisioningEngineService } from './provisioning/provisioning-engine.service';
import { ProvisioningOrchestratorService } from './provisioning/provisioning-orchestrator.service';
import { ProvisioningExecutorService } from './provisioning/provisioning-executor.service';
import { ProvisioningProgressService } from './provisioning/provisioning-progress.service';
import { ProvisioningRetryService } from './provisioning/provisioning-retry.service';
import { CompensationManager } from './provisioning/compensation-manager';
import { OnboardingChecklistService } from './services/onboarding-checklist.service';
import { IdempotencyService } from './services/idempotency.service';
import { IndustryTemplateFactory } from './industry-templates/industry-template.factory';
import { INDUSTRY_PROVIDER_CLASSES, createIndustryTemplateFactory } from './industry-templates/providers';
import { LocalEventBus } from './provisioning/local-event-bus.service';
import { PROVISION_EVENT_BUS } from './provisioning/provision-event-bus.interface';
import { ImmediateExecutionDispatcher } from './provisioning/immediate-execution-dispatcher.service';
import { PROVISION_DISPATCHER } from './provisioning/provision-dispatcher.interface';
import { OnboardingCleanupService } from './services/onboarding-cleanup.service';
import { OnboardingMetricsService } from './services/onboarding-metrics.service';
import { MemoryExporter } from './services/memory-exporter.service';
import { EventBusFactory } from './provisioning/event-bus-factory.service';
import { DispatcherFactory } from './provisioning/dispatcher-factory.service';
import { OnboardingAdminController } from './onboarding-admin.controller';
import { OnboardingAdminService } from './services/onboarding-admin.service';

@Module({
  imports: [AuditModule, PrismaModule, JwtModule.register({})],
  controllers: [OnboardingController, OnboardingAdminController],
  providers: [
    OnboardingService,
    OnboardingSessionGuard,
    ProvisioningEngineService,
    ProvisioningOrchestratorService,
    ProvisioningExecutorService,
    ProvisioningProgressService,
    ProvisioningRetryService,
    CompensationManager,
    OnboardingChecklistService,
    IdempotencyService,
    OnboardingCleanupService,
    OnboardingMetricsService,
    MemoryExporter,
    LocalEventBus,
    EventBusFactory,
    ImmediateExecutionDispatcher,
    DispatcherFactory,
    OnboardingAdminService,
    { provide: PROVISION_EVENT_BUS, useExisting: LocalEventBus },
    { provide: PROVISION_DISPATCHER, useExisting: ImmediateExecutionDispatcher },
    ...INDUSTRY_PROVIDER_CLASSES,
    createIndustryTemplateFactory(),
  ],
  exports: [
    OnboardingService,
    IndustryTemplateFactory,
    OnboardingMetricsService,
    EventBusFactory,
    DispatcherFactory,
    { provide: PROVISION_EVENT_BUS, useExisting: LocalEventBus },
  ],
})
export class OnboardingModule {}
