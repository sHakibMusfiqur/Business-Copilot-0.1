import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import type { Request } from 'express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';

export const UPLOAD_ROOT = join(process.cwd(), 'uploads');
export const SETTINGS_UPLOAD_DIR = join(UPLOAD_ROOT, 'settings');

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/webp',
]);

export function ensureUploadDirs(): void {
  mkdirSync(SETTINGS_UPLOAD_DIR, { recursive: true });
}

export const settingsMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: SETTINGS_UPLOAD_DIR,
    filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const safeExt = extname(file.originalname).toLowerCase().replace(/[^.\w]/g, '') || '.png';
      const ext = /\.(png|jpe?g|svg|ico|webp)$/.test(safeExt) ? safeExt : '.png';
      cb(null, `${Date.now()}-${randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
    files: 5,
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new BadRequestException(`Unsupported file type "${file.mimetype}". Allowed: PNG, JPG, SVG, ICO, WEBP.`), false);
      return;
    }
    cb(null, true);
  },
};
