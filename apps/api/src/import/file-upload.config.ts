import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import type { Request } from 'express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';

export const UPLOAD_ROOT = join(process.cwd(), 'uploads');
export const IMPORT_UPLOAD_DIR = join(UPLOAD_ROOT, 'imports');

export const ALLOWED_IMPORT_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls']);

export const ALLOWED_IMPORT_MIME = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'text/plain',
]);

export const MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export function ensureImportUploadDir(): void {
  mkdirSync(IMPORT_UPLOAD_DIR, { recursive: true });
}

export const importMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: IMPORT_UPLOAD_DIR,
    filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const safeExt = extname(file.originalname).toLowerCase().replace(/[^.\w]/g, '') || '.csv';
      const ext = /\.(csv|xlsx|xls)$/.test(safeExt) ? safeExt : '.csv';
      cb(null, `${Date.now()}-${randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: MAX_IMPORT_FILE_SIZE,
    files: 1,
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMPORT_EXTENSIONS.has(ext)) {
      cb(
        new BadRequestException(
          `Unsupported file type "${ext}". Allowed: .csv, .xlsx, .xls.`,
        ),
        false,
      );
      return;
    }
    if (!ALLOWED_IMPORT_MIME.has(file.mimetype)) {
      cb(
        new BadRequestException(
          `Unsupported MIME type "${file.mimetype}". Allowed: CSV, XLSX, XLS files.`,
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
};
