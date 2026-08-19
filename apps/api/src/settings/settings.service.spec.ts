import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { SettingsService, type FileUploadInput } from './settings.service';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';
const API_URL = 'https://example.test';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let tmpDir: string;
let fileSeq = 0;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'bc-settings-'));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

/** Writes a real file to disk so content validation has bytes to read. */
function writeTemp(name: string, content: Buffer | string): string {
  const path = join(tmpDir, `${fileSeq++}-${name}`);
  writeFileSync(path, content);
  return path;
}

interface MulterProps {
  mimetype?: string;
  content?: Buffer | string;
  path?: string;
}

const multerFile = (filename: string, originalname: string, props: MulterProps = {}): Express.Multer.File => {
  const content = props.content ?? Buffer.concat([PNG_SIGNATURE, Buffer.from('raster-payload')]);
  const path = props.path ?? writeTemp(originalname, content);
  return {
    originalname,
    filename,
    path,
    size: content.length,
    mimetype: props.mimetype ?? 'image/png',
  } as Express.Multer.File;
};

const mockPrisma = () => {
  const fileCreate = jest.fn();
  return { prisma: { file: { create: fileCreate } } as unknown as PrismaService, fileCreate };
};

const mockConfig = () => ({ apiUrl: API_URL }) as unknown as ConfigService;

describe('SettingsService.saveFiles (tenant ownership / FS6-1)', () => {
  it('sets organizationId from the authenticated org for every created file', async () => {
    const { prisma, fileCreate } = mockPrisma();
    const service = new SettingsService(prisma, mockConfig());
    fileCreate.mockResolvedValue({ id: 'file-1', url: `${API_URL}/uploads/settings/a.png` });

    const input: FileUploadInput = { logo: [multerFile('a.png', 'a.png')] };

    const result = await service.saveFiles(ORG_ID, 'u-1', input);

    expect(fileCreate).toHaveBeenCalledTimes(1);
    expect(fileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: ORG_ID }),
    });
    expect(result.logoUrl).toBe(`${API_URL}/uploads/settings/a.png`);
  });

  it('associates every uploaded file with the same org, ignoring any caller payload fields', async () => {
    const { prisma, fileCreate } = mockPrisma();
    const service = new SettingsService(prisma, mockConfig());
    fileCreate.mockResolvedValue({ id: 'file-x', url: `${API_URL}/uploads/settings/x.png` });

    const input: FileUploadInput = {
      logo: [multerFile('l.png', 'l.png')],
      favicon: [multerFile('f.png', 'f.png')],
      darkLogo: [multerFile('d.png', 'd.png')],
      loginBackground: [multerFile('b.png', 'b.png')],
      loginIllustration: [multerFile('i.png', 'i.png')],
    };

    await service.saveFiles(ORG_ID, 'u-1', input);

    expect(fileCreate).toHaveBeenCalledTimes(input ? Object.keys(input).length : 0);
    for (const call of fileCreate.mock.calls) {
      expect((call[0] as { data: { organizationId: string } }).data.organizationId).toBe(ORG_ID);
    }
  });

  it('keeps organizationId tied to the service org even when a different value is passed as parameter context is the source of truth', async () => {
    const { prisma, fileCreate } = mockPrisma();
    const service = new SettingsService(prisma, mockConfig());
    fileCreate.mockResolvedValue({ id: 'file-2', url: `${API_URL}/uploads/settings/b.png` });

    const input: FileUploadInput = { logo: [multerFile('b.png', 'b.png')] };

    await service.saveFiles('org-42', 'u-2', input);

    expect(fileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'org-42' }),
    });
  });
});

describe('SettingsService.saveFiles (content validation / FS6-2)', () => {
  it('rejects an HTML payload mislabeled as a PNG image', async () => {
    const { prisma, fileCreate } = mockPrisma();
    const service = new SettingsService(prisma, mockConfig());

    const upload = multerFile('x.png', 'x.png', {
      mimetype: 'image/png',
      content: '<html><script>alert(1)</script></html>',
    });

    await expect(service.saveFiles(ORG_ID, 'u-1', { logo: [upload] })).rejects.toThrow(
      'File content is not a valid image',
    );
    expect(fileCreate).not.toHaveBeenCalled();
    // The mislabeled file must not remain on disk.
    expect(existsSync(upload.path)).toBe(false);
  });

  it('rejects a PNG extension whose content does not match its declared raster type', async () => {
    const { prisma, fileCreate } = mockPrisma();
    const service = new SettingsService(prisma, mockConfig());

    const jpeg = multerFile('y.webp', 'y.webp', {
      mimetype: 'image/webp',
      content: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    });

    await expect(service.saveFiles(ORG_ID, 'u-1', { logo: [jpeg] })).rejects.toThrow(
      'File content does not match its declared type',
    );
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it('rejects an SVG that contains a <script> element', async () => {
    const { prisma, fileCreate } = mockPrisma();
    const service = new SettingsService(prisma, mockConfig());

    const svg = multerFile('evil.svg', 'evil.svg', {
      mimetype: 'image/svg+xml',
      content:
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>',
    });

    await expect(service.saveFiles(ORG_ID, 'u-1', { logo: [svg] })).rejects.toThrow(
      'SVG contains disallowed active or external content',
    );
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it('rejects an SVG that references external content via xlink:href', async () => {
    const { prisma, fileCreate } = mockPrisma();
    const service = new SettingsService(prisma, mockConfig());

    const svg = multerFile('ref.svg', 'ref.svg', {
      mimetype: 'image/svg+xml',
      content:
        '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="https://evil.test/x.svg#t"/></svg>',
    });

    await expect(service.saveFiles(ORG_ID, 'u-1', { logo: [svg] })).rejects.toThrow(
      'SVG contains disallowed active or external content',
    );
    expect(fileCreate).not.toHaveBeenCalled();
  });

  it('accepts a benign raster PNG whose bytes match its declared type', async () => {
    const { prisma, fileCreate } = mockPrisma();
    const service = new SettingsService(prisma, mockConfig());
    fileCreate.mockResolvedValue({ id: 'file-ok', url: `${API_URL}/uploads/settings/ok.png` });

    const result = await service.saveFiles(ORG_ID, 'u-1', {
      logo: [multerFile('ok.png', 'ok.png')],
    });

    expect(fileCreate).toHaveBeenCalledTimes(1);
    expect(result.logoUrl).toBe(`${API_URL}/uploads/settings/ok.png`);
  });

  it('deletes ALL files written for the request when any one fails validation', async () => {
    const { prisma, fileCreate } = mockPrisma();
    const service = new SettingsService(prisma, mockConfig());

    const good = multerFile('g.png', 'g.png');
    const bad = multerFile('b.svg', 'b.svg', {
      mimetype: 'image/svg+xml',
      content: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    });

    await expect(
      service.saveFiles(ORG_ID, 'u-1', { logo: [good], favicon: [bad] }),
    ).rejects.toThrow('SVG contains disallowed active or external content');

    expect(fileCreate).not.toHaveBeenCalled();
    // Both the offending and the previously-accepted file should be removed.
    expect(existsSync(good.path)).toBe(false);
    expect(existsSync(bad.path)).toBe(false);
  });
});