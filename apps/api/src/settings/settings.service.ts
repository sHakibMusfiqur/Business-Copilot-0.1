import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildEmailMessage } from '../mail/email-content';
import { renderEmailTemplate, type BrandEmailContext } from './email-template';
import { rejectUpload, validateUploadedFile } from './file-validation';

export interface DocumentBrandContext {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headingFont: string;
  letterheadEnabled: boolean;
  letterheadText: string;
  footerText: string;
}

export type FileUploadInput = {
  logo?: Express.Multer.File[];
  favicon?: Express.Multer.File[];
  darkLogo?: Express.Multer.File[];
  loginBackground?: Express.Multer.File[];
  loginIllustration?: Express.Multer.File[];
};

const BRAND_ASSET_MAP: ReadonlyArray<readonly [keyof FileUploadInput, string]> = [
  ['logo', 'logoUrl'],
  ['favicon', 'faviconUrl'],
  ['darkLogo', 'darkLogoUrl'],
  ['loginBackground', 'loginBackgroundUrl'],
  ['loginIllustration', 'loginIllustrationUrl'],
] as const;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async get(orgId: string, namespace: string): Promise<Record<string, unknown> | null> {
    const row = await this.getRow(orgId);
    return this.sanitize(namespace, this.namespaceValue(row, namespace));
  }

  async getAll(orgId: string): Promise<Record<string, unknown>> {
    const row = await this.getRow(orgId);
    const settings =
      row?.settings && typeof row.settings === 'object'
        ? (row.settings as Record<string, unknown>)
        : {};
    const sanitized: Record<string, unknown> = {};
    for (const [namespace, value] of Object.entries(settings)) {
      sanitized[namespace] = this.sanitize(
        namespace,
        value && typeof value === 'object' ? (value as Record<string, unknown>) : null,
      );
    }
    return sanitized;
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
      for (const key of [
        'logoUrl',
        'faviconUrl',
        'darkLogoUrl',
        'loginBackgroundUrl',
        'loginIllustrationUrl',
      ]) {
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
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    // Collect every file Multer wrote so they can be validated up front and all
    // cleaned up together if the request is rejected.
    const pending: Express.Multer.File[] = [];
    for (const [key] of BRAND_ASSET_MAP) {
      const list = files[key];
      if (list && list.length > 0) pending.push(list[0]);
    }

    // Validate the CONTENT of every uploaded file (magic bytes / SVG structure),
    // not just its client-declared MIME type or extension. All files are checked
    // before any is persisted so a request never leaves a partial DB write or an
    // orphaned file behind.
    for (const file of pending) {
      const validation = validateUploadedFile(file);
      if (!validation.ok) {
        rejectUpload(pending, validation.reason);
      }
    }

    for (const [key, urlKey] of BRAND_ASSET_MAP) {
      const list = files[key];
      if (!list || list.length === 0) continue;

      const file = list[0];

      const record = await this.prisma.file.create({
        data: {
          organizationId: orgId,
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

  /**
   * Resolves the organization's saved branding settings (all namespaces live in
   * the single `branding` JSON namespace). Used by every branded surface:
   * login, dashboard, emails, documents, PDFs and reports.
   */
  async getBranding(orgId: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });
    const settings =
      row?.settings && typeof row.settings === 'object'
        ? (row.settings as Record<string, unknown>)
        : {};
    const branding = settings.branding;
    return branding && typeof branding === 'object'
      ? (branding as Record<string, unknown>)
      : {};
  }

  /**
   * Builds the brand context used by the branded email template. Falls back to
   * platform defaults when the org has not configured branding.
   */
  async buildEmailBrand(orgId: string): Promise<BrandEmailContext> {
    const b = await this.getBranding(orgId);
    const str = (key: string, fallback: string): string =>
      typeof b[key] === 'string' && (b[key] as string).trim() ? (b[key] as string).trim() : fallback;
    const url = (key: string): string | null =>
      typeof b[key] === 'string' && (b[key] as string).trim() ? (b[key] as string).trim() : null;
    return {
      companyName: str('brandName', 'Business Copilot'),
      tagline: str('tagline', ''),
      primaryColor: str('primaryColor', '#3B82F6'),
      secondaryColor: str('secondaryColor', '#8B5CF6'),
      accentColor: str('accentColor', '#10B981'),
      logoUrl: url('logoUrl'),
      fontFamily: str('fontFamily', ''),
      footerText: str('emailFooterText', ''),
    };
  }

  /**
   * Builds the document brand context used by PDF / invoice / report / letterhead
   * rendering. Document-specific values fall back to the org's base branding.
   */
  async buildDocumentBrand(orgId: string): Promise<DocumentBrandContext> {
    const b = await this.getBranding(orgId);
    const str = (key: string, fallback: string): string =>
      typeof b[key] === 'string' && (b[key] as string).trim() ? (b[key] as string).trim() : fallback;
    const url = (key: string): string | null =>
      typeof b[key] === 'string' && (b[key] as string).trim() ? (b[key] as string).trim() : null;
    return {
      logoUrl: url('logoUrl'),
      primaryColor: str('primaryColor', '#3B82F6'),
      secondaryColor: str('secondaryColor', '#8B5CF6'),
      accentColor: str('accentColor', '#10B981'),
      fontFamily: str('fontFamily', ''),
      headingFont: str('headingFont', ''),
      letterheadEnabled: b.letterheadEnabled === true,
      letterheadText: str('letterheadText', ''),
      footerText: str('documentFooterText', ''),
    };
  }

  /**
   * Renders a sample branded email so the settings UI can preview exactly how
   * transactional mail will look with the org's logo, colors and footer. Uses
   * the same single template and content catalog as real emails.
   */
  async renderEmailPreview(orgId: string) {
    const brand = await this.buildEmailBrand(orgId);
    const { subject, content } = buildEmailMessage(
      'invitation',
      brand,
      { invitation: { inviteUrl: `${this.config.apiUrl}/email-preview` } },
    );
    return {
      subject,
      html: renderEmailTemplate(brand, content),
      brand: {
        companyName: brand.companyName,
        logoUrl: brand.logoUrl ?? null,
        primaryColor: brand.primaryColor ?? '#3B82F6',
      },
    };
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

  /**
   * Strips secrets from settings before they are returned to clients. The SMTP
   * password is write-only: it is never echoed back and can only be replaced,
   * never read.
   */
  private sanitize(
    namespace: string,
    value: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!value || namespace !== 'email') return value;
    const sanitized = { ...value };
    delete sanitized.smtpPassword;
    return sanitized;
  }
}
