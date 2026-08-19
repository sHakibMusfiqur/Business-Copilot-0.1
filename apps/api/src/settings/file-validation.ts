import { readFileSync, unlinkSync } from 'fs';
import { BadRequestException } from '@nestjs/common';

import { ALLOWED_MIME } from './file-upload.config';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const ICO_SIGNATURE = Buffer.from([0x00, 0x00, 0x01, 0x00]);

type DetectedType = 'png' | 'jpeg' | 'webp' | 'ico' | 'svg';

// Raster types whose on-disk magic bytes must match the declared MIME type.
const RASTER_BY_MIME: Record<string, DetectedType> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

// Script execution / external-resource vectors that have no legitimate place in
// a static logo or favicon. A valid branding asset should render as a picture
// only; anything that could execute or fetch external content is rejected.
const SVG_FORBIDDEN: readonly RegExp[] = [
  /<script[\s>]/i,
  /javascript:/i,
  /\son[a-z]+\s*=/i,
  /<foreignObject[\s>]/i,
  /<(?:object|embed|iframe)[\s>]/i,
  /<\s*image[\s>]/i,
  /(?:xlink:href|href)\s*=\s*["'](?!\s*#)/i,
];

export type UploadValidation =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Detects the real image type from a file's first bytes (magic numbers). Raster
 * signatures take precedence; SVG is recognised by its XML `<svg>` root so a
 * binary that merely contains the text `<svg` is still classified correctly.
 */
export function detectImageType(buffer: Buffer): DetectedType | null {
  if (
    buffer.length >= PNG_SIGNATURE.length &&
    buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    return 'png';
  }
  if (
    buffer.length >= JPEG_SIGNATURE.length &&
    buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)
  ) {
    return 'jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  if (
    buffer.length >= ICO_SIGNATURE.length &&
    buffer.subarray(0, ICO_SIGNATURE.length).equals(ICO_SIGNATURE)
  ) {
    return 'ico';
  }
  const head = buffer.toString('utf8', 0, Math.min(buffer.length, 4096));
  if (/<svg[\s>]/i.test(head)) return 'svg';
  return null;
}

/**
 * Validates an uploaded file's CONTENT (magic bytes / SVG structure), not just
 * the client-declared MIME type or extension. This stops a mislabeled file
 * (e.g. HTML/JS renamed to `.png`) or a script-bearing SVG from being stored.
 */
export function validateUploadedFile(file: {
  path: string;
  mimetype?: string;
}): UploadValidation {
  if (!file.mimetype || !ALLOWED_MIME.has(file.mimetype)) {
    return { ok: false, reason: `Unsupported file type "${file.mimetype ?? 'unknown'}"` };
  }

  let buffer: Buffer;
  try {
    buffer = readFileSync(file.path);
  } catch {
    return { ok: false, reason: 'Could not read the uploaded file' };
  }
  if (buffer.length === 0) {
    return { ok: false, reason: 'Uploaded file is empty' };
  }

  const detected = detectImageType(buffer);
  if (!detected) {
    return { ok: false, reason: 'File content is not a valid image' };
  }

  if (detected === 'svg') {
    if (file.mimetype !== 'image/svg+xml') {
      return { ok: false, reason: 'SVG content must be uploaded as image/svg+xml' };
    }
    const text = buffer.toString('utf8');
    for (const pattern of SVG_FORBIDDEN) {
      if (pattern.test(text)) {
        return { ok: false, reason: 'SVG contains disallowed active or external content' };
      }
    }
    return { ok: true };
  }

  if (RASTER_BY_MIME[file.mimetype] !== detected) {
    return {
      ok: false,
      reason: `File content does not match its declared type "${file.mimetype}"`,
    };
  }
  return { ok: true };
}

/**
 * Removes every file Multer already wrote to disk for a now-failed upload so no
 * unvalidated file is orphaned, then rethrows a generic client-facing 400.
 * Cleanup is best-effort per file.
 */
export function rejectUpload(files: Iterable<{ path?: string }>, reason: string): never {
  for (const file of files) {
    if (file.path) {
      try {
        unlinkSync(file.path);
      } catch {
        // Best-effort cleanup; missing/already-removed files are fine.
      }
    }
  }
  throw new BadRequestException(reason);
}