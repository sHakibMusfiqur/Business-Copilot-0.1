import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiParam } from '@nestjs/swagger';

import type { Response } from 'express';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

import { InvoicesService } from './invoices.service';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get()
  @Permissions(['invoices.read'])
  @ApiOperation({ summary: 'List invoices with filtering and pagination' })
  @ApiOkResponse({ description: 'Paginated list of invoices' })
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryInvoiceDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.invoicesService.findAll(orgId, query);
  }

  @Get(':id')
  @Permissions(['invoices.read'])
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.invoicesService.findById(orgId, id);
  }

  @Post('from-order/:salesOrderId')
  @Permissions(['invoices.create'])
  @ApiOperation({ summary: 'Create an invoice from a sales order' })
  @ApiParam({ name: 'salesOrderId', type: String })
  @HttpCode(HttpStatus.CREATED)
  createFromOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('salesOrderId', ParseCuidPipe) salesOrderId: string,
  ) {
    const orgId = this.requireOrg(user);
    const userId = user.id;
    return this.invoicesService.createFromOrder(orgId, userId, salesOrderId);
  }

  @Patch(':id')
  @Permissions(['invoices.update'])
  @ApiOperation({ summary: 'Update an invoice (DRAFT only)' })
  @ApiParam({ name: 'id', type: String })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    const orgId = this.requireOrg(user);
    const userId = user.id;
    return this.invoicesService.update(orgId, userId, id, dto);
  }

  @Delete(':id')
  @Permissions(['invoices.delete'])
  @ApiOperation({ summary: 'Delete a draft invoice' })
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    const orgId = this.requireOrg(user);
    const userId = user.id;
    return this.invoicesService.remove(orgId, userId, id);
  }

  @Post('update-overdue')
  @Permissions(['invoices.update'])
  @ApiOperation({ summary: 'Update overdue invoice statuses' })
  @HttpCode(HttpStatus.OK)
  async updateOverdue(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    const count = await this.invoicesService.updateOverdueStatuses(orgId);
    return { updated: count };
  }

  @Get(':id/pdf')
  @Permissions(['invoices.read'])
  @ApiOperation({ summary: 'Generate PDF for an invoice' })
  @ApiParam({ name: 'id', type: String })
  async generatePdf(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const orgId = this.requireOrg(user);
    const buffer = await this.invoicesService.generatePdf(orgId, id);
    const invoice = await this.invoicesService.findById(orgId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    });
    res.send(buffer);
  }

  @Post(':id/email')
  @Permissions(['invoices.read'])
  @ApiOperation({ summary: 'Email an invoice to the customer' })
  @ApiParam({ name: 'id', type: String })
  async emailInvoice(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const orgId = this.requireOrg(user);
    return this.invoicesService.emailInvoice(orgId, id);
  }
}
