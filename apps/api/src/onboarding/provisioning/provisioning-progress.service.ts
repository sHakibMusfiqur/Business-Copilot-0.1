import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ProvisioningProgress {
  sessionId: string;
  status: 'PENDING' | 'PROVISIONING' | 'COMPLETED' | 'FAILED';
  progress: number;
  currentTask: string | null;
  completedTasks: string[];
  failedTask: string | null;
  error: string | null;
}

@Injectable()
export class ProvisioningProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async getProgress(sessionId: string): Promise<ProvisioningProgress | null> {
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
      select: { provisionStatus: true, provisionData: true },
    });
    if (!session) return null;

    const data = session.provisionData as Record<string, unknown> | null;
    return {
      sessionId,
      status: session.provisionStatus as ProvisioningProgress['status'],
      progress: (data?.progress as number) ?? 0,
      currentTask: (data?.currentTask as string) ?? null,
      completedTasks: (data?.completedTasks as string[]) ?? [],
      failedTask: (data?.failedTask as string) ?? null,
      error: (data?.error as string) ?? null,
    };
  }

  async updateProgress(
    sessionId: string,
    progress: number,
    currentTask: string,
    completedTasks: string[],
): Promise<void> {
    // Atomic guard: never regress the authoritative COMPLETED/FAILED terminal state.
    await this.prisma.onboardingSession.updateMany({
      where: { id: sessionId, provisionStatus: { notIn: ['COMPLETED', 'FAILED'] } },
      data: {
        provisionData: { progress, currentTask, completedTasks },
      },
    });
  }

  async markFailed(sessionId: string, failedTask: string, error: string): Promise<void> {
    await this.prisma.onboardingSession.updateMany({
      where: { id: sessionId, provisionStatus: { not: 'COMPLETED' } },
      data: {
        provisionStatus: 'FAILED',
        provisionData: {
          progress: 0,
          currentTask: failedTask,
          failedTask,
          error,
        },
      },
    });
  }

  async markCompleted(sessionId: string, organizationId: string, subscriptionId: string | null): Promise<void> {
    await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        provisionStatus: 'COMPLETED',
        organizationId,
        subscriptionId,
        provisionData: {
          progress: 100,
          currentTask: 'Complete',
          completedTasks: [],
          provisionedAt: new Date().toISOString(),
        },
      },
    });
  }
}
