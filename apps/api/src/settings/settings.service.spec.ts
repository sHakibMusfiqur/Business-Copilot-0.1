import { SettingsService, type FileUploadInput } from './settings.service';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';
const API_URL = 'https://example.test';

const multerFile = (filename: string, originalname: string): Express.Multer.File =>
  ({
    originalname,
    filename,
    path: `uploads/settings/${filename}`,
    size: 1024,
    mimetype: 'image/png',
  }) as Express.Multer.File;

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