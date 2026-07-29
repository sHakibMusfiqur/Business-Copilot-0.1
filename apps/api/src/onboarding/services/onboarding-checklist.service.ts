import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ChecklistItemDto {
  id: string;
  itemId: string;
  label: string;
  icon: string | null;
  href: string | null;
  completed: boolean;
  skippable: boolean;
  sortOrder: number;
  completedAt: string | null;
}

const DEFAULT_CHECKLIST = [
  { itemId: 'logo', label: 'Upload company logo', icon: 'Upload', href: '/settings/branding', sortOrder: 1 },
  { itemId: 'team', label: 'Invite team members', icon: 'Users', href: '/organization/members', sortOrder: 2 },
  { itemId: 'email', label: 'Connect email integration', icon: 'Mail', href: '/settings/email', sortOrder: 3 },
  { itemId: 'preferences', label: 'Configure preferences', icon: 'Settings', href: '/settings/preferences', sortOrder: 4 },
  { itemId: 'tax', label: 'Set up tax & compliance', icon: 'FileBarChart', href: '/settings/tax', sortOrder: 5 },
  { itemId: 'roles', label: 'Define roles & permissions', icon: 'Shield', href: '/roles', sortOrder: 6 },
  { itemId: 'branding', label: 'Customize branding', icon: 'Palette', href: '/settings/branding', sortOrder: 7 },
  { itemId: 'data', label: 'Import existing data', icon: 'Database', href: '/settings/import', sortOrder: 8 },
  { itemId: 'billing', label: 'Configure billing', icon: 'CreditCard', href: '/settings/billing', sortOrder: 9 },
  { itemId: 'notifications', label: 'Set up notifications', icon: 'Bell', href: '/settings/notifications', sortOrder: 10 },
];

@Injectable()
export class OnboardingChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  async initChecklist(sessionId: string): Promise<ChecklistItemDto[]> {
    await this.prisma.checklistItem.deleteMany({ where: { sessionId } });

    const items = await this.prisma.checklistItem.createManyAndReturn({
      data: DEFAULT_CHECKLIST.map((item) => ({
        sessionId,
        itemId: item.itemId,
        label: item.label,
        icon: item.icon,
        href: item.href,
        sortOrder: item.sortOrder,
      })),
    });

    return items.map(this.mapItem);
  }

  async getChecklist(sessionId: string): Promise<ChecklistItemDto[]> {
    const items = await this.prisma.checklistItem.findMany({
      where: { sessionId },
      orderBy: { sortOrder: 'asc' },
    });

    if (items.length === 0) {
      return this.initChecklist(sessionId);
    }

    return items.map(this.mapItem);
  }

  async markComplete(sessionId: string, itemId: string): Promise<ChecklistItemDto> {
    const item = await this.prisma.checklistItem.findFirst({
      where: { sessionId, itemId },
    });
    if (!item) throw new NotFoundException('Checklist item not found');

    const updated = await this.prisma.checklistItem.update({
      where: { id: item.id },
      data: { completed: true, completedAt: new Date() },
    });

    return this.mapItem(updated);
  }

  async markIncomplete(sessionId: string, itemId: string): Promise<ChecklistItemDto> {
    const item = await this.prisma.checklistItem.findFirst({
      where: { sessionId, itemId },
    });
    if (!item) throw new NotFoundException('Checklist item not found');

    const updated = await this.prisma.checklistItem.update({
      where: { id: item.id },
      data: { completed: false, completedAt: null },
    });

    return this.mapItem(updated);
  }

  async skipItem(sessionId: string, itemId: string): Promise<ChecklistItemDto> {
    const item = await this.prisma.checklistItem.findFirst({
      where: { sessionId, itemId },
    });
    if (!item) throw new NotFoundException('Checklist item not found');

    const updated = await this.prisma.checklistItem.update({
      where: { id: item.id },
      data: { completed: true, completedAt: new Date() },
    });

    return this.mapItem(updated);
  }

  async getProgress(sessionId: string): Promise<{ total: number; completed: number; percentage: number }> {
    const items = await this.prisma.checklistItem.findMany({
      where: { sessionId },
    });
    const total = items.length;
    const completedCount = items.filter((i) => i.completed).length;
    return {
      total,
      completed: completedCount,
      percentage: total > 0 ? Math.round((completedCount / total) * 100) : 0,
    };
  }

  private mapItem(item: Record<string, unknown>): ChecklistItemDto {
    return {
      id: item.id as string,
      itemId: item.itemId as string,
      label: item.label as string,
      icon: item.icon as string | null,
      href: item.href as string | null,
      completed: item.completed as boolean,
      skippable: item.skippable as boolean,
      sortOrder: item.sortOrder as number,
      completedAt: item.completedAt ? (item.completedAt as Date).toISOString() : null,
    };
  }
}
