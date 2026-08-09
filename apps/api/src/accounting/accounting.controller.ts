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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

import { AccountingService } from './accounting.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { QueryAccountDto } from './dto/query-account.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import { QueryJournalEntryDto } from './dto/query-journal-entry.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryReceivableDto } from './dto/query-receivable.dto';
import { QueryPayableDto } from './dto/query-payable.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';

@ApiTags('Accounting')
@Controller('accounting')
@UseGuards(JwtAuthGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  // ─── Summary ──────────────────────────────────────────────────

  @Get('summary')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.accounts.read', 'reports.finance'])
  @ApiBearerAuth('access-token')
  async getSummary(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.accountingService.getSummary(orgId);
  }

  // ─── Chart of Accounts ────────────────────────────────────────

  @Get('accounts')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.accounts.read'])
  @ApiBearerAuth('access-token')
  async findAllAccounts(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryAccountDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.findAllAccounts(orgId, query);
  }

  @Get('accounts/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.accounts.read'])
  @ApiBearerAuth('access-token')
  async findAccountById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.findAccountById(orgId, id);
  }

  @Post('accounts')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.accounts.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  async createAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateAccountDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.createAccount(orgId, dto);
  }

  @Patch('accounts/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.accounts.update'])
  @ApiBearerAuth('access-token')
  async updateAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.updateAccount(orgId, id, dto);
  }

  @Delete('accounts/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.accounts.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  async deleteAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.deleteAccount(orgId, id);
  }

  // ─── Journal Entries ──────────────────────────────────────────

  @Get('journal')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.journal.read'])
  @ApiBearerAuth('access-token')
  async findAllJournalEntries(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryJournalEntryDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.findAllJournalEntries(orgId, query);
  }

  @Get('journal/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.journal.read'])
  @ApiBearerAuth('access-token')
  async findJournalEntryById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.findJournalEntryById(orgId, id);
  }

  @Post('journal')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.journal.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  async createJournalEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateJournalEntryDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.createJournalEntry(orgId, user.id, dto);
  }

  @Patch('journal/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.journal.create'])
  @ApiBearerAuth('access-token')
  async updateJournalEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateJournalEntryDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.updateJournalEntry(orgId, user.id, id, dto);
  }

  @Post('journal/:id/post')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.journal.post'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  async postJournalEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.postJournalEntry(orgId, user.id, id);
  }

  @Delete('journal/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.journal.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  async deleteJournalEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.deleteJournalEntry(orgId, user.id, id);
  }

  // ─── Receivables ──────────────────────────────────────────────

  @Get('receivables')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.receivables.read'])
  @ApiBearerAuth('access-token')
  async findAllReceivables(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryReceivableDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.findAllReceivables(orgId, query);
  }

  // ─── Payables ─────────────────────────────────────────────────

  @Get('payables')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.payables.read'])
  @ApiBearerAuth('access-token')
  async findAllPayables(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryPayableDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.findAllPayables(orgId, query);
  }

  // ─── Payments ─────────────────────────────────────────────────

  @Get('payments')
  @UseGuards(PermissionGuard)
  @Permissions(['payments.read'])
  @ApiBearerAuth('access-token')
  async findAllPayments(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryPaymentDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.findAllPayments(orgId, query);
  }

  @Post('payments')
  @UseGuards(PermissionGuard)
  @Permissions(['payments.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  async createPayment(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePaymentDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.createPayment(orgId, user.id, dto);
  }

  // ─── General Ledger ───────────────────────────────────────────

  @Get('ledger')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.journal.read', 'reports.finance'])
  @ApiBearerAuth('access-token')
  async getGeneralLedger(
    @CurrentUser() user: CurrentUserPayload,
    @Query('accountId') accountId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.accountingService.getGeneralLedger(orgId, { accountId, dateFrom, dateTo });
  }

  // ─── Trial Balance ────────────────────────────────────────────

  @Get('trial-balance')
  @UseGuards(PermissionGuard)
  @Permissions(['accounting.journal.read', 'reports.finance'])
  @ApiBearerAuth('access-token')
  async getTrialBalance(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.accountingService.getTrialBalance(orgId);
  }
}
