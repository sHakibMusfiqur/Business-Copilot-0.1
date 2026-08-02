import { Injectable, NotFoundException } from '@nestjs/common';
import { type ChecklistItem } from '@prisma/client';
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
  { itemId: 'logo', label: 'Upload company logo', icon: 'Upload', href: '/settings/branding?tab=logo', sortOrder: 1 },
  { itemId: 'team', label: 'Invite team members', icon: 'Users', href: '/organization/members', sortOrder: 2 },
  { itemId: 'email', label: 'Connect email integration', icon: 'Mail', href: '/settings/email', sortOrder: 3 },
  { itemId: 'preferences', label: 'Configure preferences', icon: 'Settings', href: '/settings/preferences', sortOrder: 4 },
  { itemId: 'tax', label: 'Set up tax & compliance', icon: 'FileBarChart', href: '/settings/tax', sortOrder: 5 },
  { itemId: 'roles', label: 'Define roles & permissions', icon: 'Shield', href: '/settings/roles', sortOrder: 6 },
  { itemId: 'branding', label: 'Customize branding', icon: 'Palette', href: '/settings/branding?tab=theme', sortOrder: 7 },
  { itemId: 'data', label: 'Import existing data', icon: 'Database', href: '/settings/import', sortOrder: 8 },
  { itemId: 'billing', label: 'Configure billing', icon: 'CreditCard', href: '/settings/billing', sortOrder: 9 },
  { itemId: 'notifications', label: 'Set up notifications', icon: 'Bell', href: '/settings/notifications', sortOrder: 10 },
];

// Backward-compatibility migration: pre-deep-link checklists stored plain
// routes for several items. On read we rewrite those to their canonical
// destinations (deep links / the page that owns completion).
const HREF_MIGRATIONS: Record<string, { legacy: string; target: string }> = {
  logo: { legacy: '/settings/branding', target: '/settings/branding?tab=logo' },
  branding: { legacy: '/settings/branding', target: '/settings/branding?tab=theme' },
  roles: { legacy: '/roles', target: '/settings/roles' },
};

/**
 * Maps a stored href to its canonical destination. Idempotent: new
 * (already canonical) values and any unrelated hrefs pass through unchanged.
 */
function normalizeChecklistHref(itemId: string, href: string | null): string | null {
  if (href === null) return href;
  const migration = HREF_MIGRATIONS[itemId];
  if (migration && (href === migration.legacy || href === `${migration.legacy}/`)) {
    return migration.target;
  }
  return href;
}

@Injectable()
export class OnboardingChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initializes the checklist for a session. Uses a PostgreSQL advisory lock
   * (the project is PostgreSQL-only, see schema.prisma) to serialize
   * concurrent first reads so no duplicate rows are created, and re-checks for
   * existing rows so it is safe to run repeatedly.
   */
  async initChecklist(sessionId: string): Promise<ChecklistItemDto[]> {
    const items = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`;
      const existing = await tx.checklistItem.findMany({ where: { sessionId } });
      if (existing.length > 0) {
        return existing;
      }
      await tx.checklistItem.deleteMany({ where: { sessionId } });
      return tx.checklistItem.createManyAndReturn({
        data: DEFAULT_CHECKLIST.map((item) => ({
          sessionId,
          itemId: item.itemId,
          label: item.label,
          icon: item.icon,
          href: item.href,
          sortOrder: item.sortOrder,
        })),
      });
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

    const migrated = await this.persistHrefMigrations(items);

    return migrated.map(this.mapItem);
  }

  /**
   * Rewrites legacy hrefs to their canonical destinations and persists the
   * change so existing checklists benefit without being recreated.
   *
   * This is a one-time migration: after the first pass every row is already
   * canonical (changed.length === 0) and no DB write happens. It affects at
   * most a few rows, so a Prisma transaction of update() calls is used for
   * readability — the round-trip saving of a single-statement CASE UPDATE
   * would be negligible at this scale.
   */
  private async persistHrefMigrations(items: ChecklistItem[]): Promise<ChecklistItem[]> {
    const changed = items
      .map((item) => ({ item, href: normalizeChecklistHref(item.itemId, item.href) }))
      .filter(({ item, href }) => href !== item.href);

    if (changed.length === 0) {
      return items;
    }

    await this.prisma.$transaction(
      changed.map(({ item, href }) =>
        this.prisma.checklistItem.update({ where: { id: item.id }, data: { href } }),
      ),
    );

    const hrefById = new Map(changed.map(({ item, href }) => [item.id, href]));
    return items.map((item) => {
      const href = hrefById.get(item.id);
      return href !== undefined ? { ...item, href } : item;
    });
  }

  /**
   * Marks an item complete. Delegates to setCompletion, which uses updateMany
   * because ChecklistItem has no unique (sessionId, itemId) index — see the
   * rationale there before changing this.
   */
  async markComplete(sessionId: string, itemId: string): Promise<ChecklistItemDto> {
    return this.setCompletion(sessionId, itemId, true);
  }

  /**
   * Marks an item incomplete. Delegates to setCompletion, which uses updateMany
   * because ChecklistItem has no unique (sessionId, itemId) index — see the
   * rationale there before changing this.
   */
  async markIncomplete(sessionId: string, itemId: string): Promise<ChecklistItemDto> {
    return this.setCompletion(sessionId, itemId, false);
  }

  /**
   * Skips an item (equivalent to completing it). Delegates to setCompletion,
   * which uses updateMany because ChecklistItem has no unique (sessionId,
   * itemId) index — see the rationale there before changing this.
   */
  async skipItem(sessionId: string, itemId: string): Promise<ChecklistItemDto> {
    return this.setCompletion(sessionId, itemId, true);
  }

  /**
   * Marks a checklist item complete/incomplete/skipped.
   *
   * updateMany is used to scope the write to the (sessionId, itemId) pair. No
   * unique composite index exists on ChecklistItem, so a single update() by
   * unique key is impossible without a schema change. The count check rejects
   * missing rows before any follow-up read, and the record is only fetched
   * after the write succeeded (no read-then-write gap). A true single-query
   * implementation would require adding @@unique([sessionId, itemId]).
   */
  private async setCompletion(sessionId: string, itemId: string, completed: boolean): Promise<ChecklistItemDto> {
    const result = await this.prisma.checklistItem.updateMany({
      where: { sessionId, itemId },
      data: { completed, completedAt: completed ? new Date() : null },
    });
    if (result.count === 0) throw new NotFoundException('Checklist item not found');

    const updated = await this.prisma.checklistItem.findFirst({
      where: { sessionId, itemId },
    });
    if (!updated) throw new NotFoundException('Checklist item not found');
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
      completed: Math.min(completedCount, total),
      percentage: total > 0 ? Math.min(100, Math.round((Math.min(completedCount, total) / total) * 100)) : 0,
    };
  }

  private mapItem(item: ChecklistItem): ChecklistItemDto {
    return {
      id: item.id,
      itemId: item.itemId,
      label: item.label,
      icon: item.icon,
      href: normalizeChecklistHref(item.itemId, item.href),
      completed: item.completed,
      skippable: item.skippable,
      sortOrder: item.sortOrder,
      completedAt: item.completedAt ? item.completedAt.toISOString() : null,
    };
  }
}
