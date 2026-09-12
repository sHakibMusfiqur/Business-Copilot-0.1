import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import type { QueryInvoiceDto } from './dto/query-invoice.dto';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(orgId: string, query: QueryInvoiceDto) {
    const {
      page = 1,
      limit = 10,
      search,
      customerId,
      salesOrderId,
      paymentStatus,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.InvoiceWhereInput = {
      organizationId: orgId,
    };

    if (search) {
      const sanitized = search.trim();
      where.OR = [
        { invoiceNumber: { contains: sanitized, mode: 'insensitive' } },
        { notes: { contains: sanitized, mode: 'insensitive' } },
        { customer: { name: { contains: sanitized, mode: 'insensitive' } } },
      ];
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (salesOrderId) {
      where.salesOrderId = salesOrderId;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (dateFrom || dateTo) {
      where.issueDate = {};
      if (dateFrom) { where.issueDate.gte = new Date(dateFrom); }
      if (dateTo) { where.issueDate.lte = new Date(dateTo); }
    }

    const allowedSortFields = ['invoiceNumber', 'total', 'paymentStatus', 'createdAt', 'issueDate', 'dueDate'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, invoices] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          type: true,
          status: true,
          paymentStatus: true,
          subtotal: true,
          taxTotal: true,
          discountTotal: true,
          total: true,
          paidAmount: true,
          notes: true,
          issueDate: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
          customer: { select: { id: true, name: true } },
          salesOrder: { select: { id: true, orderNumber: true } },
          createdBy: { select: { id: true, name: true } },
          items: { select: { id: true, quantity: true, unitPrice: true, total: true } },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = invoices.map((inv) => ({
      ...inv,
      balance: Number(inv.total) - Number(inv.paidAmount),
      itemCount: inv.items.length,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(orgId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        salesOrder: { select: { id: true, orderNumber: true, status: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return {
      ...invoice,
      balance: Number(invoice.total) - Number(invoice.paidAmount),
    };
  }

  async create(orgId: string, userId: string, dto: CreateInvoiceDto) {
    // Validate customer belongs to org
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId: orgId, deletedAt: null },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found or does not belong to this organization');
    }

    // Validate products belong to org
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, organizationId: orgId },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found or do not belong to this organization');
    }

    // Build items with totals
    const items = dto.items.map((item) => {
      const lineTotal = (item.unitPrice * item.quantity) - (item.discount || 0) + (item.taxAmount || 0);
      return {
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate || 0,
        taxAmount: item.taxAmount || 0,
        discount: item.discount || 0,
        total: lineTotal,
      };
    });

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const discountTotal = items.reduce((sum, item) => sum + item.discount, 0);
    const taxTotal = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const total = subtotal - discountTotal + taxTotal;

    if (total < 0) {
      throw new BadRequestException('Invoice total cannot be negative');
    }

    // Generate invoice number with retry
    let invoice: Prisma.InvoiceGetPayload<{ include: { items: true } }>;

    const MAX_RETRIES = 20;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const invoiceNumber = await this.generateInvoiceNumber(orgId);
        invoice = await this.prisma.invoice.create({
          data: {
            invoiceNumber,
            organizationId: orgId,
            type: 'SALES',
            customerId: dto.customerId,
            issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            status: 'DRAFT',
            paymentStatus: 'PENDING',
            subtotal,
            taxTotal,
            discountTotal,
            total,
            paidAmount: 0,
            notes: dto.notes,
            createdById: userId,
            items: {
              create: items,
            },
          },
          include: { items: true },
        });

        await this.auditService.record({
          userId,
          organizationId: orgId,
          action: 'INVOICE_CREATED',
          entity: 'Invoice',
          entityId: invoice.id,
          status: 'SUCCESS',
          metadata: { invoiceNumber: invoice.invoiceNumber, customerId: dto.customerId },
        });

        return invoice;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }

    this.logger.error(`Failed to generate unique invoice number after ${MAX_RETRIES} attempts`);
    throw new InternalServerErrorException('Failed to generate unique invoice number');
  }

  async createFromOrder(orgId: string, userId: string, salesOrderId: string) {
    // Load SalesOrder with items, scoped to org — outside transaction, read-only
    const sale = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, organizationId: orgId, deletedAt: null },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        customer: { select: { id: true, name: true } },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sales order not found');
    }

    // Validate order is in invoiceable state
    if (sale.status !== 'DELIVERED') {
      throw new BadRequestException(
        `Cannot create invoice for order in ${sale.status} status. Order must be DELIVERED.`,
      );
    }

    // Build invoice items from sales order items
    const invoiceItems = sale.items.map((soItem) => ({
      productId: soItem.productId,
      description: soItem.description,
      quantity: Number(soItem.quantity),
      unitPrice: Number(soItem.unitPrice),
      taxRate: 0,
      taxAmount: Number(soItem.tax),
      discount: Number(soItem.discount),
      total: Number(soItem.lineTotal),
    }));

    const subtotal = Number(sale.subtotal);
    const discountTotal = Number(sale.discount);
    const taxTotal = Number(sale.tax);
    const total = Number(sale.total);

    // Due date: 30 days from order date
    const dueDate = new Date(sale.orderDate);
    dueDate.setDate(dueDate.getDate() + 30);

    // Advisory lock serializes invoice number generation + creation per-org.
    // This eliminates the read-then-write race in generateInvoiceNumber().
    const lockKey = this.computeAdvisoryLockKey(orgId);

    const invoice = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      // Idempotency check — inside lock so concurrent requests see the same state
      const existingInvoice = await tx.invoice.findFirst({
        where: { salesOrderId: sale.id, organizationId: orgId },
      });
      if (existingInvoice) {
        throw new ConflictException(
          `Invoice ${existingInvoice.invoiceNumber} already exists for this sales order`,
        );
      }

      const invoiceNumber = await this.generateInvoiceNumber(orgId, tx);
      return tx.invoice.create({
        data: {
          invoiceNumber,
          organizationId: orgId,
          type: 'SALES',
          customerId: sale.customerId,
          salesOrderId: sale.id,
          issueDate: new Date(),
          dueDate,
          status: 'DRAFT',
          paymentStatus: 'PENDING',
          subtotal,
          taxTotal,
          discountTotal,
          total,
          paidAmount: 0,
          notes: `Invoice for ${sale.orderNumber}`,
          createdById: userId,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          items: true,
          customer: true,
          salesOrder: true,
        },
      });
    });

    // Audit log outside transaction — only written on success
    await this.auditService.record({
      userId,
      organizationId: orgId,
      action: 'INVOICE_CREATED',
      entity: 'Invoice',
      entityId: invoice.id,
      status: 'SUCCESS',
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        salesOrderId: sale.id,
        salesOrderNumber: sale.orderNumber,
        customerId: sale.customerId,
      },
    });

    return invoice;
  }

  async update(orgId: string, userId: string, invoiceId: string, dto: UpdateInvoiceDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Only allow editing DRAFT invoices
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot edit invoice in ${invoice.status} status. Only DRAFT invoices can be edited.`,
      );
    }

    // If customerId is being changed, validate it belongs to org
    if (dto.customerId && dto.customerId !== invoice.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId: orgId, deletedAt: null },
      });
      if (!customer) {
        throw new BadRequestException('Customer not found or does not belong to this organization');
      }
    }

    const updateData: Prisma.InvoiceUpdateInput = {};
    if (dto.customerId !== undefined) updateData.customer = { connect: { id: dto.customerId } };
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.issueDate !== undefined) updateData.issueDate = new Date(dto.issueDate);
    if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        items: true,
        customer: { select: { id: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
      },
    });

    await this.auditService.record({
      userId,
      organizationId: orgId,
      action: 'INVOICE_UPDATED',
      entity: 'Invoice',
      entityId: invoiceId,
      status: 'SUCCESS',
      metadata: { invoiceNumber: updated.invoiceNumber },
    });

    return updated;
  }

  async remove(orgId: string, userId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Only allow deleting DRAFT invoices
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot delete invoice in ${invoice.status} status. Only DRAFT invoices can be deleted.`,
      );
    }

    await this.prisma.invoice.delete({
      where: { id: invoiceId },
    });

    await this.auditService.record({
      userId,
      organizationId: orgId,
      action: 'INVOICE_DELETED',
      entity: 'Invoice',
      entityId: invoiceId,
      status: 'SUCCESS',
      metadata: { invoiceNumber: invoice.invoiceNumber },
    });

    return { id: invoiceId, message: 'Invoice deleted successfully' };
  }

  private computeAdvisoryLockKey(orgId: string): number {
    let hash = 0;
    for (let i = 0; i < orgId.length; i++) {
      hash = ((hash << 5) - hash + orgId.charCodeAt(i)) | 0;
    }
    return (hash & 0x7fffffff) || 1;
  }

  private async generateInvoiceNumber(
    orgId: string,
    client?: Prisma.TransactionClient,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const lastInvoice = await (client ?? this.prisma).invoice.findFirst({
      where: { organizationId: orgId, invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    let nextSeq = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('-');
      nextSeq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  }
}
