import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, JournalEntryStatus, PaymentType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateAccountDto } from './dto/create-account.dto';
import type { UpdateAccountDto } from './dto/update-account.dto';
import type { QueryAccountDto } from './dto/query-account.dto';
import type { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import type { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import type { QueryJournalEntryDto } from './dto/query-journal-entry.dto';
import type { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Chart of Accounts ────────────────────────────────────────

  async findAllAccounts(orgId: string, query: QueryAccountDto) {
    const { page = 1, limit = 50, search, type, isActive, sortBy = 'code', sortOrder = 'asc' } = query;

    const where: Prisma.AccountWhereInput = { organizationId: orgId };

    if (search) {
      const sanitized = search.trim();
      where.OR = [
        { code: { contains: sanitized, mode: 'insensitive' } },
        { name: { contains: sanitized, mode: 'insensitive' } },
      ];
    }

    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;

    const allowedSortFields = ['code', 'name', 'type', 'createdAt'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'code';
    const order = sortOrder === 'desc' ? 'desc' : 'asc';

    const [total, accounts] = await Promise.all([
      this.prisma.account.count({ where }),
      this.prisma.account.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          parentId: true,
          description: true,
          isActive: true,
          createdAt: true,
          parent: { select: { id: true, code: true, name: true } },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: accounts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAccountById(orgId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId: orgId },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        parent: { select: { id: true, code: true, name: true } },
        childAccounts: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  async createAccount(orgId: string, dto: CreateAccountDto) {
    if (dto.parentId) {
      const parent = await this.prisma.account.findFirst({
        where: { id: dto.parentId, organizationId: orgId },
      });
      if (!parent) throw new NotFoundException('Parent account not found');
    }

    try {
      const account = await this.prisma.account.create({
        data: {
          code: dto.code,
          name: dto.name,
          type: dto.type,
          parentId: dto.parentId ?? null,
          description: dto.description ?? null,
          organizationId: orgId,
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          parentId: true,
          description: true,
          createdAt: true,
        },
      });

      this.logger.log(`Account created: ${account.code} - ${account.name} (${account.id})`);
      return account;
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('An account with this code already exists for your organization');
      }
      throw err;
    }
  }

  async updateAccount(orgId: string, accountId: string, dto: UpdateAccountDto) {
    const existing = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId: orgId },
    });

    if (!existing) throw new NotFoundException('Account not found');

    if (dto.parentId && dto.parentId === accountId) {
      throw new BadRequestException('An account cannot be its own parent');
    }

    if (dto.parentId) {
      const parent = await this.prisma.account.findFirst({
        where: { id: dto.parentId, organizationId: orgId },
      });
      if (!parent) throw new NotFoundException('Parent account not found');
    }

    try {
      const updated = await this.prisma.account.update({
        where: { id: accountId },
        data: {
          code: dto.code,
          name: dto.name,
          type: dto.type,
          parentId: dto.parentId,
          description: dto.description,
          isActive: dto.isActive,
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          parentId: true,
          description: true,
          isActive: true,
          updatedAt: true,
        },
      });

      this.logger.log(`Account updated: ${updated.code} - ${updated.name} (${accountId})`);
      return updated;
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('An account with this code already exists for your organization');
      }
      throw err;
    }
  }

  async deleteAccount(orgId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId: orgId },
      include: { childAccounts: { select: { id: true } }, journalEntryLines: { select: { id: true } } },
    });

    if (!account) throw new NotFoundException('Account not found');

    if (account.childAccounts.length > 0) {
      throw new BadRequestException('Cannot delete an account with child accounts. Reassign or delete children first.');
    }

    if (account.journalEntryLines.length > 0) {
      throw new BadRequestException('Cannot delete an account with journal entries. Deactivate it instead.');
    }

    await this.prisma.account.delete({ where: { id: accountId } });
    this.logger.log(`Account deleted: ${account.code} - ${account.name} (${accountId})`);
    return { message: 'Account deleted successfully' };
  }

  // ─── Journal Entries ──────────────────────────────────────────

  async findAllJournalEntries(orgId: string, query: QueryJournalEntryDto) {
    const { page = 1, limit = 10, search, status, dateFrom, dateTo, sortBy = 'date', sortOrder = 'desc' } = query;

    const where: Prisma.JournalEntryWhereInput = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { entryNumber: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const allowedSortFields = ['entryNumber', 'date', 'description', 'status', 'createdAt'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'date';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, entries] = await Promise.all([
      this.prisma.journalEntry.count({ where }),
      this.prisma.journalEntry.findMany({
        where,
        select: {
          id: true,
          entryNumber: true,
          date: true,
          description: true,
          status: true,
          referenceId: true,
          referenceType: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true } },
          lines: {
            select: {
              id: true,
              debit: true,
              credit: true,
              description: true,
              account: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = entries.map((e) => ({
      ...e,
      totalDebit: e.lines.reduce((sum, l) => sum + Number(l.debit), 0),
      totalCredit: e.lines.reduce((sum, l) => sum + Number(l.credit), 0),
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findJournalEntryById(orgId: string, entryId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id: entryId, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        entryNumber: true,
        date: true,
        description: true,
        status: true,
        referenceId: true,
        referenceType: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, name: true } },
        lines: {
          select: {
            id: true,
            debit: true,
            credit: true,
            description: true,
            account: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
    });

    if (!entry) throw new NotFoundException('Journal entry not found');
    return entry;
  }

  async createJournalEntry(orgId: string, userId: string, dto: CreateJournalEntryDto) {
    const { debitTotal, creditTotal } = this.validateLines(dto.lines);

    if (debitTotal !== creditTotal) {
      throw new BadRequestException(
        `Journal entry is not balanced. Debits: ${debitTotal}, Credits: ${creditTotal}`,
      );
    }

    await this.validateAccountIds(orgId, dto.lines.map((l) => l.accountId));

    const entryNumber = await this.generateJournalEntryNumber(orgId);

    const entry = await this.prisma.journalEntry.create({
      data: {
        entryNumber,
        organizationId: orgId,
        description: dto.description,
        referenceId: dto.referenceId ?? null,
        referenceType: dto.referenceType ?? null,
        createdById: userId,
        lines: {
          create: dto.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description ?? null,
          })),
        },
      },
      select: {
        id: true,
        entryNumber: true,
        date: true,
        description: true,
        status: true,
        createdAt: true,
        lines: {
          select: { id: true, debit: true, credit: true, account: { select: { code: true, name: true } } },
        },
      },
    });

    this.logger.log(`Journal entry created: ${entry.entryNumber} (${entry.id}) by ${userId}`);
    return entry;
  }

  async updateJournalEntry(orgId: string, _userId: string, entryId: string, dto: UpdateJournalEntryDto) {
    const existing = await this.prisma.journalEntry.findFirst({
      where: { id: entryId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) throw new NotFoundException('Journal entry not found');

    if (existing.status !== JournalEntryStatus.DRAFT) {
      throw new ConflictException('Only DRAFT journal entries can be updated');
    }

    if (dto.lines) {
      const { debitTotal, creditTotal } = this.validateLines(dto.lines);

      if (debitTotal !== creditTotal) {
        throw new BadRequestException(
          `Journal entry is not balanced. Debits: ${debitTotal}, Credits: ${creditTotal}`,
        );
      }

      await this.validateAccountIds(orgId, dto.lines.map((l) => l.accountId));
    }

    if (dto.lines) {
      const lines = dto.lines;
      await this.prisma.$transaction(async (tx) => {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: entryId } });

        await tx.journalEntryLine.createMany({
          data: lines.map((l) => ({
            journalEntryId: entryId,
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description ?? null,
          })),
        });

        if (dto.description) {
          await tx.journalEntry.update({
            where: { id: entryId },
            data: { description: dto.description },
          });
        }
      });

      return { id: entryId, message: 'Journal entry updated successfully' };
    }

    if (dto.description) {
      await this.prisma.journalEntry.update({
        where: { id: entryId },
        data: { description: dto.description },
      });
    }

    return { id: entryId, message: 'Journal entry updated successfully' };
  }

  async postJournalEntry(orgId: string, userId: string, entryId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id: entryId, organizationId: orgId, deletedAt: null },
    });

    if (!entry) throw new NotFoundException('Journal entry not found');

    if (entry.status !== JournalEntryStatus.DRAFT) {
      throw new ConflictException('Only DRAFT journal entries can be posted');
    }

    const updated = await this.prisma.journalEntry.update({
      where: { id: entryId },
      data: { status: JournalEntryStatus.POSTED },
      select: { id: true, entryNumber: true, status: true, date: true },
    });

    this.logger.log(`Journal entry posted: ${updated.entryNumber} (${entryId}) by ${userId}`);
    return updated;
  }

  async deleteJournalEntry(orgId: string, userId: string, entryId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id: entryId, organizationId: orgId, deletedAt: null },
    });

    if (!entry) throw new NotFoundException('Journal entry not found');

    if (entry.status === JournalEntryStatus.POSTED) {
      throw new ConflictException('Posted journal entries cannot be deleted. Create a reversing entry instead.');
    }

    await this.prisma.journalEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Journal entry deleted: ${entry.entryNumber} (${entryId}) by ${userId}`);
    return { message: 'Journal entry deleted successfully' };
  }

  // ─── Receivables ──────────────────────────────────────────────

  async findAllReceivables(orgId: string, query: { page?: number; limit?: number; status?: string; search?: string }) {
    const { page = 1, limit = 10, status, search } = query;

    const where: Prisma.ReceivableWhereInput = { organizationId: orgId };

    if (status) where.status = status as 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search.trim(), mode: 'insensitive' } },
        { customer: { name: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }

    const [total, receivables] = await Promise.all([
      this.prisma.receivable.count({ where }),
      this.prisma.receivable.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          dueDate: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
          notes: true,
          createdAt: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = receivables.map((r) => ({
      ...r,
      balance: Number(r.totalAmount) - Number(r.paidAmount),
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Payables ─────────────────────────────────────────────────

  async findAllPayables(orgId: string, query: { page?: number; limit?: number; status?: string; search?: string }) {
    const { page = 1, limit = 10, status, search } = query;

    const where: Prisma.PayableWhereInput = { organizationId: orgId };

    if (status) where.status = status as 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    if (search) {
      where.OR = [
        { billNumber: { contains: search.trim(), mode: 'insensitive' } },
        { supplier: { name: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }

    const [total, payables] = await Promise.all([
      this.prisma.payable.count({ where }),
      this.prisma.payable.findMany({
        where,
        select: {
          id: true,
          billNumber: true,
          dueDate: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
          notes: true,
          createdAt: true,
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = payables.map((p) => ({
      ...p,
      balance: Number(p.totalAmount) - Number(p.paidAmount),
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Payments ─────────────────────────────────────────────────

  async findAllPayments(orgId: string, query: { page?: number; limit?: number; type?: PaymentType }) {
    const { page = 1, limit = 10, type } = query;

    const where: Prisma.PaymentWhereInput = { organizationId: orgId };

    if (type) where.type = type;

    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          type: true,
          amount: true,
          paymentDate: true,
          reference: true,
          notes: true,
          createdAt: true,
          customer: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          allocations: {
            select: {
              id: true,
              amount: true,
              receivable: { select: { id: true, invoiceNumber: true } },
              payable: { select: { id: true, billNumber: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: payments,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createPayment(orgId: string, userId: string, dto: CreatePaymentDto) {
    if (dto.type === PaymentType.CUSTOMER_PAYMENT && !dto.customerId) {
      throw new BadRequestException('customerId is required for customer payments');
    }

    if (dto.type === PaymentType.SUPPLIER_PAYMENT && !dto.supplierId) {
      throw new BadRequestException('supplierId is required for supplier payments');
    }

    // D-B1: customer/supplier payments must be allocated to an existing receivable/payable.
    // Without this, payments can exist without any accounting journal, creating
    // orphan/unreconciled entries. The allocation method below validates org-scoping.
    if (dto.type === PaymentType.CUSTOMER_PAYMENT && !dto.receivableId) {
      throw new BadRequestException('receivableId is required for customer payments');
    }

    if (dto.type === PaymentType.SUPPLIER_PAYMENT && !dto.payableId) {
      throw new BadRequestException('payableId is required for supplier payments');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: dto.customerId, organizationId: orgId },
          select: { id: true },
        });
        if (!customer) {
          throw new BadRequestException('customerId does not belong to this organization');
        }
      }
      if (dto.supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: dto.supplierId, organizationId: orgId },
          select: { id: true },
        });
        if (!supplier) {
          throw new BadRequestException('supplierId does not belong to this organization');
        }
      }

      const payment = await tx.payment.create({
        data: {
          organizationId: orgId,
          type: dto.type,
          customerId: dto.customerId ?? null,
          supplierId: dto.supplierId ?? null,
          amount: dto.amount,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
          createdById: userId,
        },
        select: {
          id: true,
          type: true,
          amount: true,
          paymentDate: true,
          reference: true,
          createdAt: true,
        },
      });

      await this.processPaymentAllocation(orgId, userId, payment.id, dto, tx);

      this.logger.log(`Payment created: ${payment.id} (${dto.type}) by ${userId}`);
      return payment;
    });
  }

  // ─── General Ledger ───────────────────────────────────────────

  async getGeneralLedger(
    orgId: string,
    query: { accountId?: string; dateFrom?: string; dateTo?: string },
  ) {
    const { accountId, dateFrom, dateTo } = query;

    const where: Prisma.JournalEntryLineWhereInput = {
      journalEntry: {
        organizationId: orgId,
        status: JournalEntryStatus.POSTED,
        deletedAt: null,
      },
    };

    if (accountId) where.accountId = accountId;

    const dateFilter: Prisma.JournalEntryWhereInput['date'] = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);
    if (dateFrom || dateTo) {
      where.journalEntry = {
        ...(where.journalEntry as Prisma.JournalEntryWhereInput),
        date: dateFilter,
      };
    }

    const accounts = await this.prisma.account.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true },
    });

    let filteredAccounts = accounts;
    if (accountId) {
      filteredAccounts = accounts.filter((a) => a.id === accountId);
    }

    const result = await Promise.all(
      filteredAccounts.map(async (account) => {
        const lines = await this.prisma.journalEntryLine.findMany({
          where: {
            ...where,
            accountId: account.id,
          },
          select: {
            debit: true,
            credit: true,
            description: true,
            journalEntry: {
              select: { entryNumber: true, date: true, description: true },
            },
          },
          orderBy: { journalEntry: { date: 'asc' } },
        });

        let runningBalance = 0;
        const entries = lines.map((l) => {
          const debit = Number(l.debit);
          const credit = Number(l.credit);
          if (account.type === 'ASSET' || account.type === 'EXPENSE') {
            runningBalance += debit - credit;
          } else {
            runningBalance += credit - debit;
          }
          return {
            date: l.journalEntry.date,
            entryNumber: l.journalEntry.entryNumber,
            description: l.journalEntry.description,
            lineDescription: l.description,
            debit,
            credit,
            runningBalance: Math.round(runningBalance * 100) / 100,
          };
        });

        const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
        const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);

        return {
          account: { id: account.id, code: account.code, name: account.name, type: account.type },
          openingBalance: 0,
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100,
          closingBalance: Math.round(runningBalance * 100) / 100,
          entries,
        };
      }),
    );

    return { data: result };
  }

  // ─── Trial Balance ────────────────────────────────────────────

  async getTrialBalance(orgId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true },
    });

    const result = await Promise.all(
      accounts.map(async (account) => {
        const lines = await this.prisma.journalEntryLine.findMany({
          where: {
            accountId: account.id,
            journalEntry: {
              organizationId: orgId,
              status: JournalEntryStatus.POSTED,
              deletedAt: null,
            },
          },
          select: { debit: true, credit: true },
        });

        const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
        const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);

        let balance: number;
        let balanceType: 'debit' | 'credit';
        if (account.type === 'ASSET' || account.type === 'EXPENSE') {
          balance = totalDebit - totalCredit;
          balanceType = balance >= 0 ? 'debit' : 'credit';
        } else {
          balance = totalCredit - totalDebit;
          balanceType = balance >= 0 ? 'credit' : 'debit';
        }

        return {
          account: { id: account.id, code: account.code, name: account.name, type: account.type },
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100,
          balance: Math.round(Math.abs(balance) * 100) / 100,
          balanceType,
        };
      }),
    );

    const grandTotalDebit = result.reduce((s, r) => s + r.totalDebit, 0);
    const grandTotalCredit = result.reduce((s, r) => s + r.totalCredit, 0);
    const isBalanced = grandTotalDebit === grandTotalCredit;

    return {
      data: result,
      summary: {
        totalDebit: Math.round(grandTotalDebit * 100) / 100,
        totalCredit: Math.round(grandTotalCredit * 100) / 100,
        isBalanced,
      },
    };
  }

  // ─── Summary ──────────────────────────────────────────────────

  async getSummary(orgId: string) {
    const postedWhere = { status: JournalEntryStatus.POSTED, deletedAt: null };

    const [accounts, receivables, payables, postedEntries, revenueLines, expenseLines, cashLines] = await Promise.all([
      this.prisma.account.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { id: true, type: true },
      }),
      this.prisma.receivable.findMany({
        where: { organizationId: orgId },
        select: { totalAmount: true, paidAmount: true, status: true },
      }),
      this.prisma.payable.findMany({
        where: { organizationId: orgId },
        select: { totalAmount: true, paidAmount: true, status: true },
      }),
      this.prisma.journalEntry.count({
        where: { organizationId: orgId, ...postedWhere },
      }),
      this.prisma.journalEntryLine.aggregate({
        where: {
          account: { organizationId: orgId, type: 'REVENUE' },
          journalEntry: { organizationId: orgId, ...postedWhere },
        },
        _sum: { credit: true },
      }),
      this.prisma.journalEntryLine.aggregate({
        where: {
          account: { organizationId: orgId, type: 'EXPENSE' },
          journalEntry: { organizationId: orgId, ...postedWhere },
        },
        _sum: { debit: true },
      }),
      this.prisma.journalEntryLine.findMany({
        where: {
          account: { organizationId: orgId, code: '1000' },
          journalEntry: { organizationId: orgId, ...postedWhere },
        },
        select: { debit: true, credit: true },
      }),
    ]);

    const totalAR = receivables.reduce((s, r) => s + Number(r.totalAmount), 0);
    const totalARPending = receivables
      .filter((r) => r.status !== 'PAID' && r.status !== 'CANCELLED')
      .reduce((s, r) => s + (Number(r.totalAmount) - Number(r.paidAmount)), 0);

    const totalAP = payables.reduce((s, p) => s + Number(p.totalAmount), 0);
    const totalAPPending = payables
      .filter((p) => p.status !== 'PAID' && p.status !== 'CANCELLED')
      .reduce((s, p) => s + (Number(p.totalAmount) - Number(p.paidAmount)), 0);

    const totalRevenue = Math.round(Number(revenueLines._sum.credit ?? 0) * 100) / 100;
    const totalExpenses = Math.round(Number(expenseLines._sum.debit ?? 0) * 100) / 100;
    const cashBalance = cashLines.reduce((acc, l) => acc + Number(l.debit) - Number(l.credit), 0);

    return {
      totalAccounts: accounts.length,
      totalAccountsByType: {
        ASSET: accounts.filter((a) => a.type === 'ASSET').length,
        LIABILITY: accounts.filter((a) => a.type === 'LIABILITY').length,
        EQUITY: accounts.filter((a) => a.type === 'EQUITY').length,
        REVENUE: accounts.filter((a) => a.type === 'REVENUE').length,
        EXPENSE: accounts.filter((a) => a.type === 'EXPENSE').length,
      },
      totalReceivables: receivables.length,
      totalReceivablesAmount: totalAR,
      outstandingReceivables: totalARPending,
      totalPayables: payables.length,
      totalPayablesAmount: totalAP,
      outstandingPayables: totalAPPending,
      postedJournalEntries: postedEntries,
      totalRevenue,
      totalExpenses,
      cashBalance: Math.round(cashBalance * 100) / 100,
    };
  }

  // ─── Purchase → Accounting Integration ────────────────────────

  async createPayableForPurchase(
    orgId: string,
    purchaseId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.db(tx);

    const existing = await client.payable.findFirst({
      where: { purchaseOrderId: purchaseId, organizationId: orgId },
    });
    if (existing) return existing;

    const purchase = await client.purchaseOrder.findUnique({
      where: { id: purchaseId },
      select: { orderNumber: true, total: true, supplierId: true, orderDate: true },
    });

    if (!purchase) throw new NotFoundException('Purchase order not found');

    const dueDate = new Date(purchase.orderDate);
    dueDate.setDate(dueDate.getDate() + 30);

    return client.payable.create({
      data: {
        organizationId: orgId,
        supplierId: purchase.supplierId,
        purchaseOrderId: purchaseId,
        billNumber: `BILL-${purchase.orderNumber}`,
        dueDate,
        totalAmount: purchase.total,
        paidAmount: 0,
        status: 'PENDING',
      },
      select: {
        id: true,
        billNumber: true,
        totalAmount: true,
        status: true,
        dueDate: true,
      },
    });
  }

  async createJournalForPurchaseReceive(
    orgId: string,
    userId: string,
    purchaseId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.db(tx);

    const purchase = await client.purchaseOrder.findUnique({
      where: { id: purchaseId },
      select: { orderNumber: true, total: true },
    });

    if (!purchase) throw new NotFoundException('Purchase order not found');

    const existing = await client.journalEntry.findFirst({
      where: {
        referenceId: purchase.orderNumber,
        referenceType: 'PURCHASE_RECEIVE',
        organizationId: orgId,
        deletedAt: null,
      },
    });
    if (existing) return existing;

    const inventoryAccount = await this.findAccountByCode(orgId, '1200', client);
    const apAccount = await this.findAccountByCode(orgId, '2000', client);

    const amount = Number(purchase.total);
    const entryNumber = await this.generateJournalEntryNumber(orgId, client);

    return client.journalEntry.create({
      data: {
        entryNumber,
        organizationId: orgId,
        description: `Purchase Received: ${purchase.orderNumber}`,
        date: new Date(),
        status: 'POSTED',
        referenceId: purchase.orderNumber,
        referenceType: 'PURCHASE_RECEIVE',
        createdById: userId,
        lines: {
          create: [
            {
              accountId: inventoryAccount.id,
              debit: amount,
              credit: 0,
              description: `Inventory - ${purchase.orderNumber}`,
            },
            {
              accountId: apAccount.id,
              debit: 0,
              credit: amount,
              description: `Accounts Payable - ${purchase.orderNumber}`,
            },
          ],
        },
      },
      select: {
        id: true,
        entryNumber: true,
        date: true,
        status: true,
        description: true,
        referenceId: true,
        referenceType: true,
        createdAt: true,
      },
    });
  }

  // ─── Sales → Accounting Integration ────────────────────────────

  async createReceivableForSales(
    orgId: string,
    saleId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.db(tx);

    const existing = await client.receivable.findFirst({
      where: { salesOrderId: saleId, organizationId: orgId },
    });
    if (existing) return existing;

    const sale = await client.salesOrder.findUnique({
      where: { id: saleId },
      select: { orderNumber: true, total: true, customerId: true, orderDate: true },
    });

    if (!sale) throw new NotFoundException('Sales order not found');

    const dueDate = new Date(sale.orderDate);
    dueDate.setDate(dueDate.getDate() + 30);

    return client.receivable.create({
      data: {
        organizationId: orgId,
        customerId: sale.customerId,
        salesOrderId: saleId,
        invoiceNumber: `INV-${sale.orderNumber}`,
        dueDate,
        totalAmount: sale.total,
        paidAmount: 0,
        status: 'PENDING',
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        dueDate: true,
      },
    });
  }

  async createRevenueJournalEntry(
    orgId: string,
    userId: string,
    saleId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.db(tx);

    const sale = await client.salesOrder.findUnique({
      where: { id: saleId },
      select: { orderNumber: true, total: true, orderDate: true },
    });

    if (!sale) throw new NotFoundException('Sales order not found');

    const existing = await client.journalEntry.findFirst({
      where: {
        referenceId: sale.orderNumber,
        referenceType: 'SALES_REVENUE',
        organizationId: orgId,
        deletedAt: null,
      },
    });
    if (existing) return existing;

    const arAccount = await this.findAccountByCode(orgId, '1100', client);
    const revenueAccount = await this.findAccountByCode(orgId, '4000', client);

    const amount = Number(sale.total);
    const entryNumber = await this.generateJournalEntryNumber(orgId, client);

    return client.journalEntry.create({
      data: {
        entryNumber,
        organizationId: orgId,
        description: `Sales Revenue: ${sale.orderNumber}`,
        date: new Date(),
        status: 'POSTED',
        referenceId: sale.orderNumber,
        referenceType: 'SALES_REVENUE',
        createdById: userId,
        lines: {
          create: [
            {
              accountId: arAccount.id,
              debit: amount,
              credit: 0,
              description: `Accounts Receivable - ${sale.orderNumber}`,
            },
            {
              accountId: revenueAccount.id,
              debit: 0,
              credit: amount,
              description: `Revenue - ${sale.orderNumber}`,
            },
          ],
        },
      },
      select: {
        id: true,
        entryNumber: true,
        date: true,
        status: true,
        description: true,
        referenceId: true,
        referenceType: true,
        createdAt: true,
      },
    });
  }

  async createCOGSJournalEntry(
    orgId: string,
    userId: string,
    saleId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.db(tx);

    const sale = await client.salesOrder.findUnique({
      where: { id: saleId },
      select: { orderNumber: true },
    });

    if (!sale) throw new NotFoundException('Sales order not found');

    const existing = await client.journalEntry.findFirst({
      where: {
        referenceId: sale.orderNumber,
        referenceType: 'SALES_COGS',
        organizationId: orgId,
        deletedAt: null,
      },
    });
    if (existing) return existing;

    const items = await client.salesOrderItem.findMany({
      where: { salesOrderId: saleId },
      select: { quantity: true, productId: true },
    });

    if (items.length === 0) {
      this.logger.warn(`No items found for sales order ${sale.orderNumber}, skipping COGS journal entry`);
      return null;
    }

    const productIds = items.map((i) => i.productId).filter(Boolean) as string[];
    const products = productIds.length > 0
      ? await client.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, costPrice: true },
        })
      : [];

    const costMap = new Map(products.map((p) => [p.id, Number(p.costPrice)]));

    let totalCOGS = 0;
    for (const item of items) {
      if (!item.productId) continue;
      const costPrice = costMap.get(item.productId) ?? 0;
      totalCOGS += Number(item.quantity) * costPrice;
    }

    totalCOGS = Math.round(totalCOGS * 100) / 100;

    if (totalCOGS <= 0) {
      this.logger.warn(`COGS is zero for sales order ${sale.orderNumber}, skipping journal entry`);
      return null;
    }

    const cogsAccount = await this.findAccountByCode(orgId, '5000', client);
    const inventoryAccount = await this.findAccountByCode(orgId, '1200', client);

    const entryNumber = await this.generateJournalEntryNumber(orgId, client);

    return client.journalEntry.create({
      data: {
        entryNumber,
        organizationId: orgId,
        description: `Cost of Goods Sold: ${sale.orderNumber}`,
        date: new Date(),
        status: 'POSTED',
        referenceId: sale.orderNumber,
        referenceType: 'SALES_COGS',
        createdById: userId,
        lines: {
          create: [
            {
              accountId: cogsAccount.id,
              debit: totalCOGS,
              credit: 0,
              description: `COGS - ${sale.orderNumber}`,
            },
            {
              accountId: inventoryAccount.id,
              debit: 0,
              credit: totalCOGS,
              description: `Inventory - ${sale.orderNumber}`,
            },
          ],
        },
      },
      select: {
        id: true,
        entryNumber: true,
        date: true,
        status: true,
        description: true,
        referenceId: true,
        referenceType: true,
        createdAt: true,
      },
    });
  }

  // ─── Payment Integration ────────────────────────────────────────

  private async processPaymentAllocation(
    orgId: string,
    userId: string,
    paymentId: string,
    dto: CreatePaymentDto,
    tx: Prisma.TransactionClient,
  ) {
    if (dto.type === PaymentType.CUSTOMER_PAYMENT && dto.receivableId) {
      // Serialize concurrent allocations against the same receivable with a row
      // lock, so only one transaction observes the authoritative paidAmount/status.
      await tx.$queryRaw`SELECT id FROM "Receivable" WHERE id = ${dto.receivableId} AND "organizationId" = ${orgId} FOR UPDATE`;

      const receivable = await tx.receivable.findFirst({
        where: { id: dto.receivableId, organizationId: orgId },
      });

      if (!receivable) throw new NotFoundException('Receivable not found');

      if (receivable.status === 'PAID') {
        throw new BadRequestException('Receivable is already fully paid');
      }

      if (receivable.status === 'CANCELLED') {
        throw new BadRequestException('Receivable is cancelled and cannot receive payments');
      }

      const totalAmount = Number(receivable.totalAmount);
      const paidAmount = Number(receivable.paidAmount);
      const remaining = totalAmount - paidAmount;

      if (Number(dto.amount) > remaining) {
        throw new BadRequestException(
          `Payment amount exceeds the remaining balance of ${remaining.toFixed(2)} for this receivable`,
        );
      }

      const newPaidAmount = paidAmount + Number(dto.amount);
      const isPaid = newPaidAmount >= totalAmount;

      await tx.paymentAllocation.create({
        data: {
          paymentId,
          receivableId: dto.receivableId,
          amount: dto.amount,
        },
      });

      await tx.receivable.update({
        where: { id: dto.receivableId },
        data: {
          paidAmount: newPaidAmount,
          status: isPaid ? 'PAID' : 'PARTIALLY_PAID',
        },
      });

      await this.createPaymentJournalEntry(orgId, userId, paymentId, dto, tx);
    }

    if (dto.type === PaymentType.SUPPLIER_PAYMENT && dto.payableId) {
      // Serialize concurrent allocations against the same payable with a row
      // lock, so only one transaction observes the authoritative paidAmount/status.
      await tx.$queryRaw`SELECT id FROM "Payable" WHERE id = ${dto.payableId} AND "organizationId" = ${orgId} FOR UPDATE`;

      const payable = await tx.payable.findFirst({
        where: { id: dto.payableId, organizationId: orgId },
      });

      if (!payable) throw new NotFoundException('Payable not found');

      if (payable.status === 'PAID') {
        throw new BadRequestException('Payable is already fully paid');
      }

      if (payable.status === 'CANCELLED') {
        throw new BadRequestException('Payable is cancelled and cannot receive payments');
      }

      const totalAmount = Number(payable.totalAmount);
      const paidAmount = Number(payable.paidAmount);
      const remaining = totalAmount - paidAmount;

      if (Number(dto.amount) > remaining) {
        throw new BadRequestException(
          `Payment amount exceeds the remaining balance of ${remaining.toFixed(2)} for this payable`,
        );
      }

      const newPaidAmount = paidAmount + Number(dto.amount);
      const isPaid = newPaidAmount >= totalAmount;

      await tx.paymentAllocation.create({
        data: {
          paymentId,
          payableId: dto.payableId,
          amount: dto.amount,
        },
      });

      await tx.payable.update({
        where: { id: dto.payableId },
        data: {
          paidAmount: newPaidAmount,
          status: isPaid ? 'PAID' : 'PARTIALLY_PAID',
        },
      });

      await this.createPaymentJournalEntry(orgId, userId, paymentId, dto, tx);
    }
  }

  private async createPaymentJournalEntry(
    orgId: string,
    userId: string,
    paymentId: string,
    dto: CreatePaymentDto,
    tx: Prisma.TransactionClient,
  ) {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { reference: true },
    });

    const ref = payment?.reference ?? dto.reference ?? '';

    if (dto.type === PaymentType.CUSTOMER_PAYMENT && dto.receivableId) {
      const cashAccount = await this.findAccountByCode(orgId, '1000', tx);
      const arAccount = await this.findAccountByCode(orgId, '1100', tx);

      const entryNumber = await this.generateJournalEntryNumber(orgId, tx);
      const existing = await tx.journalEntry.findFirst({
        where: {
          referenceId: paymentId,
          referenceType: 'PAYMENT',
          organizationId: orgId,
          deletedAt: null,
        },
      });
      if (existing) return existing;

      return tx.journalEntry.create({
        data: {
          entryNumber,
          organizationId: orgId,
          description: `Customer Payment: ${ref || paymentId}`,
          date: new Date(),
          status: 'POSTED',
          referenceId: paymentId,
          referenceType: 'PAYMENT',
          createdById: userId,
          lines: {
            create: [
              {
                accountId: cashAccount.id,
                debit: Number(dto.amount),
                credit: 0,
                description: `Cash - ${ref || paymentId}`,
              },
              {
                accountId: arAccount.id,
                debit: 0,
                credit: Number(dto.amount),
                description: `Accounts Receivable - ${ref || paymentId}`,
              },
            ],
          },
        },
        select: {
          id: true,
          entryNumber: true,
          date: true,
          status: true,
          createdAt: true,
        },
      });
    }

    if (dto.type === PaymentType.SUPPLIER_PAYMENT && dto.payableId) {
      const apAccount = await this.findAccountByCode(orgId, '2000', tx);
      const cashAccount = await this.findAccountByCode(orgId, '1000', tx);

      const entryNumber = await this.generateJournalEntryNumber(orgId, tx);
      const existing = await tx.journalEntry.findFirst({
        where: {
          referenceId: paymentId,
          referenceType: 'PAYMENT',
          organizationId: orgId,
          deletedAt: null,
        },
      });
      if (existing) return existing;

      return tx.journalEntry.create({
        data: {
          entryNumber,
          organizationId: orgId,
          description: `Supplier Payment: ${ref || paymentId}`,
          date: new Date(),
          status: 'POSTED',
          referenceId: paymentId,
          referenceType: 'PAYMENT',
          createdById: userId,
          lines: {
            create: [
              {
                accountId: apAccount.id,
                debit: Number(dto.amount),
                credit: 0,
                description: `Accounts Payable - ${ref || paymentId}`,
              },
              {
                accountId: cashAccount.id,
                debit: 0,
                credit: Number(dto.amount),
                description: `Cash - ${ref || paymentId}`,
              },
            ],
          },
        },
        select: {
          id: true,
          entryNumber: true,
          date: true,
          status: true,
          createdAt: true,
        },
      });
    }

    return null;
  }

  // ─── Private Helpers ──────────────────────────────────────────

  private db(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  private async findAccountByCode(
    orgId: string,
    code: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const account = await client.account.findFirst({
      where: { organizationId: orgId, code },
    });

    if (!account) {
      throw new BadRequestException(
        `Account with code "${code}" not found. Please ensure the chart of accounts is seeded.`,
      );
    }

    return account;
  }

  private validateLines(lines: Array<{ debit: number; credit: number }>) {
    let debitTotal = 0;
    let creditTotal = 0;

    for (const line of lines) {
      debitTotal += Number(line.debit);
      creditTotal += Number(line.credit);
    }

    debitTotal = Math.round(debitTotal * 100) / 100;
    creditTotal = Math.round(creditTotal * 100) / 100;

    return { debitTotal, creditTotal };
  }

  private async validateAccountIds(orgId: string, accountIds: string[]) {
    const uniqueIds = [...new Set(accountIds)];
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: uniqueIds }, organizationId: orgId },
      select: { id: true },
    });

    if (accounts.length !== uniqueIds.length) {
      throw new BadRequestException('One or more accounts not found in your organization');
    }
  }

  private async generateJournalEntryNumber(
    orgId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JE-${year}-`;

    const lastEntry = await client.journalEntry.findFirst({
      where: {
        organizationId: orgId,
        entryNumber: { startsWith: prefix },
      },
      orderBy: { entryNumber: 'desc' },
      select: { entryNumber: true },
    });

    let nextSeq = 1;
    if (lastEntry) {
      const parts = lastEntry.entryNumber.split('-');
      nextSeq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  }
}
