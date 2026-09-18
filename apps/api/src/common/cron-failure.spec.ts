import { InvoicesService } from '../invoices/invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';

function createAudit() {
  return { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
}

function createMail() {
  return { sendOrgEmail: jest.fn().mockResolvedValue(undefined) } as unknown as MailService;
}

function createAccounting() {
  return { updateReceivableOverdueStatuses: jest.fn().mockResolvedValue(0) } as never;
}

function createPrisma(overrides: Record<string, unknown> = {}) {
  return {
    organization: {
      findMany: jest.fn().mockResolvedValue(overrides.orgs ?? []),
    },
    invoice: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  };
}

describe('Cron Failure Tests', () => {
  describe('A. DB failure during cron — organization listing failure propagates, per-org failures are isolated', () => {
    it('should propagate database error when organization.findMany fails', async () => {
      const prisma = createPrisma();
      (prisma.organization.findMany as jest.Mock).mockRejectedValue(
        new Error('Database timeout'),
      );

      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        createAudit(),
        createMail(),
        createAccounting(),
      );

      await expect(
        service.handleOverdueInvoices(),
      ).rejects.toThrow('Database timeout');
    });

    it('should log and continue when updateMany fails for a single org', async () => {
      const prisma = createPrisma({
        orgs: [{ id: 'org-1' }],
      });
      (prisma.invoice.updateMany as jest.Mock).mockRejectedValue(
        new Error('Connection refused'),
      );

      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        createAudit(),
        createMail(),
        createAccounting(),
      );

      const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

      await expect(
        service.handleOverdueInvoices(),
      ).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('org-1'),
      );
      loggerSpy.mockRestore();
    });

    it('should continue processing remaining orgs when one org fails', async () => {
      const prisma = createPrisma({
        orgs: [{ id: 'org-bad' }, { id: 'org-ok' }],
      });
      (prisma.invoice.updateMany as jest.Mock)
        .mockRejectedValueOnce(new Error('Deadlock detected'))
        .mockResolvedValueOnce({ count: 5 });

      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        createAudit(),
        createMail(),
        createAccounting(),
      );

      await expect(
        service.handleOverdueInvoices(),
      ).resolves.toBeUndefined();

      expect(prisma.invoice.updateMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('B. One org failure — should isolate failure and continue processing remaining orgs', () => {
    it('should continue processing remaining orgs after one org fails', async () => {
      const prisma = createPrisma({
        orgs: [{ id: 'org-bad' }, { id: 'org-ok' }],
      });
      (prisma.invoice.updateMany as jest.Mock)
        .mockRejectedValueOnce(new Error('org-bad failed'))
        .mockResolvedValueOnce({ count: 4 });

      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        createAudit(),
        createMail(),
        createAccounting(),
      );

      await expect(
        service.handleOverdueInvoices(),
      ).resolves.toBeUndefined();

      expect(prisma.invoice.updateMany).toHaveBeenCalledTimes(2);
    });

    it('should process all remaining orgs after a failure', async () => {
      const prisma = createPrisma({
        orgs: [{ id: 'org-1' }, { id: 'org-2' }, { id: 'org-3' }],
      });
      (prisma.invoice.updateMany as jest.Mock)
        .mockRejectedValueOnce(new Error('First org DB error'))
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 3 });

      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        createAudit(),
        createMail(),
        createAccounting(),
      );

      await expect(
        service.handleOverdueInvoices(),
      ).resolves.toBeUndefined();

      expect(prisma.invoice.updateMany).toHaveBeenCalledTimes(3);
    });

    it('should log the failure for the failing org', async () => {
      const prisma = createPrisma({
        orgs: [{ id: 'org-bad' }, { id: 'org-ok' }],
      });
      (prisma.invoice.updateMany as jest.Mock)
        .mockRejectedValueOnce(new Error('Deadlock detected'))
        .mockResolvedValueOnce({ count: 1 });

      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        createAudit(),
        createMail(),
        createAccounting(),
      );

      const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

      await service.handleOverdueInvoices();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('org-bad'),
      );

      loggerSpy.mockRestore();
    });
  });

  describe('C. Repeated execution — should be idempotent', () => {
    it('should produce consistent results across multiple calls', async () => {
      const prisma = createPrisma({
        orgs: [{ id: 'org-1' }],
      });
      (prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        createAudit(),
        createMail(),
        createAccounting(),
      );

      await service.handleOverdueInvoices();
      await service.handleOverdueInvoices();

      expect(prisma.invoice.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.invoice.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: { paymentStatus: 'OVERDUE' },
        }),
      );
    });

    it('should return same result when no overdue invoices exist', async () => {
      const prisma = createPrisma({
        orgs: [{ id: 'org-1' }],
      });
      (prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        createAudit(),
        createMail(),
        createAccounting(),
      );

      await service.handleOverdueInvoices();
      await service.handleOverdueInvoices();

      expect(prisma.invoice.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.invoice.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        }),
      );
    });

    it('should be idempotent when called many times', async () => {
      const prisma = createPrisma({
        orgs: [{ id: 'org-1' }, { id: 'org-2' }],
      });
      (prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        createAudit(),
        createMail(),
        createAccounting(),
      );

      const calls = 5;
      for (let i = 0; i < calls; i++) {
        await service.handleOverdueInvoices();
      }

      expect(prisma.invoice.updateMany).toHaveBeenCalledTimes(calls * 2);
    });
  });

  describe('D. Zero organizations — should complete without error', () => {
    it('should complete successfully with no organizations', async () => {
      const prisma = createPrisma({
        orgs: [],
      });

      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        createAudit(),
        createMail(),
        createAccounting(),
      );

      await expect(
        service.handleOverdueInvoices(),
      ).resolves.toBeUndefined();
      expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    });

    it('should complete when organization.findMany returns empty array', async () => {
      const prisma = createPrisma();
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([]);

      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        createAudit(),
        createMail(),
        createAccounting(),
      );

      await expect(
        service.handleOverdueInvoices(),
      ).resolves.toBeUndefined();
      expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    });

    it('should handle zero organizations gracefully after previous successful runs', async () => {
      const prisma = createPrisma();
      (prisma.organization.findMany as jest.Mock)
        .mockResolvedValueOnce([{ id: 'org-1' }])
        .mockResolvedValueOnce([]);

      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        createAudit(),
        createMail(),
        createAccounting(),
      );

      await service.handleOverdueInvoices();
      expect(prisma.invoice.updateMany).toHaveBeenCalledTimes(1);

      await service.handleOverdueInvoices();
      expect(prisma.invoice.updateMany).toHaveBeenCalledTimes(1);
    });
  });
});
