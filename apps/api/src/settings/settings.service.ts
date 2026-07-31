import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';

export type FileUploadInput = {
  logo?: Express.Multer.File[];
  favicon?: Express.Multer.File[];
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async get(orgId: string, namespace: string): Promise<Record<string, unknown> | null> {
    const row = await this.getRow(orgId);
    return this.namespaceValue(row, namespace);
  }

  async getAll(orgId: string): Promise<Record<string, unknown>> {
    const row = await this.getRow(orgId);
    return row?.settings && typeof row.settings === 'object'
      ? (row.settings as Record<string, unknown>)
      : {};
  }

  async upsert(
    orgId: string,
    namespace: string,
    settings: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const row = await this.getRow(orgId);
    const current = row?.settings && typeof row.settings === 'object'
      ? (row.settings as Record<string, unknown>)
      : {};
    const currentNamespace = this.namespaceValue(row, namespace) ?? {};
    const mergedNamespace = { ...currentNamespace, ...settings };

    if (namespace === 'branding') {
      for (const key of ['logoUrl', 'faviconUrl']) {
        const value = mergedNamespace[key];
        if (typeof value === 'string' && value.trim() === '') mergedNamespace[key] = null;
      }
    }

    const next: Record<string, unknown> = {
      ...current,
      [namespace]: mergedNamespace,
    };

    await this.prisma.organizationSettings.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, settings: next as Prisma.InputJsonValue },
      update: { settings: next as Prisma.InputJsonValue },
    });

    return next[namespace] as Record<string, unknown>;
  }

  async saveFiles(
    orgId: string,
    userId: string | undefined,
    files: FileUploadInput,
  ): Promise<{ logoUrl?: string; faviconUrl?: string }> {
    const result: { logoUrl?: string; faviconUrl?: string } = {};

    for (const [key, urlKey] of [
      ['logo', 'logoUrl'],
      ['favicon', 'faviconUrl'],
    ] as const) {
      const list = files?.[key];
      if (!list || list.length === 0) continue;

      const file = list[0];
      const record = await this.prisma.file.create({
        data: {
          originalName: file.originalname,
          fileName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          path: file.path,
          url: `${this.config.apiUrl}/uploads/settings/${file.filename}`,
          uploadedById: userId ?? null,
          entityType: 'organization_settings',
          entityId: orgId,
        },
      });

      if (record.url) result[urlKey] = record.url;
    }

    return result;
  }

  private async getRow(orgId: string) {
    return this.prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });
  }

  private namespaceValue(
    row: { settings: unknown } | null,
    namespace: string,
  ): Record<string, unknown> | null {
    if (!row?.settings || typeof row.settings !== 'object') return null;
    const value = (row.settings as Record<string, unknown>)[namespace];
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null;
  }
}
