import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { StartImportDto } from './dto/start-import.dto';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists an import job request. The frontend sends only file metadata
   * (name, size, format) — not the actual file content — so this records the
   * import intent and returns the job record. The actual file processing is
   * deferred to a background worker that would read from a storage location.
   */
  async startImport(orgId: string, userId: string, dto: StartImportDto) {
    // Validate file extension matches the declared format
    const ext = dto.fileName.toLowerCase().slice(dto.fileName.lastIndexOf('.'));
    const formatMap: Record<string, string[]> = {
      CSV: ['.csv'],
      XLSX: ['.xlsx'],
      XLS: ['.xls'],
    };
    const allowed = formatMap[dto.fileFormat] ?? [];
    if (!allowed.includes(ext)) {
      throw new BadRequestException(
        `File extension "${ext}" does not match the selected format "${dto.fileFormat}". Expected: ${allowed.join(', ')}`,
      );
    }

    const job = await this.prisma.importJob.create({
      data: {
        organizationId: orgId,
        userId,
        importType: dto.importType,
        fileFormat: dto.fileFormat,
        delimiter: dto.delimiter,
        skipFirstRow: dto.skipFirstRow,
        updateExisting: dto.updateExisting,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        status: 'PENDING',
      },
    });

    this.logger.log(
      `Import job created: ${job.id} (${dto.importType}, ${dto.fileName}, ${dto.fileFormat})`,
    );

    return {
      id: job.id,
      status: job.status,
      importType: job.importType,
      fileName: job.fileName,
      createdAt: job.createdAt,
    };
  }

  /**
   * Returns all import jobs for an organization.
   */
  async getImportJobs(orgId: string) {
    return this.prisma.importJob.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        importType: true,
        fileFormat: true,
        fileName: true,
        fileSize: true,
        status: true,
        importedCount: true,
        errorCount: true,
        errors: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Returns a single import job by ID, scoped to the organization.
   */
  async getImportJob(orgId: string, jobId: string) {
    const job = await this.prisma.importJob.findFirst({
      where: { id: jobId, organizationId: orgId },
      select: {
        id: true,
        importType: true,
        fileFormat: true,
        delimiter: true,
        skipFirstRow: true,
        updateExisting: true,
        fileName: true,
        fileSize: true,
        status: true,
        importedCount: true,
        errorCount: true,
        errors: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!job) {
      throw new BadRequestException('Import job not found');
    }

    return job;
  }
}
