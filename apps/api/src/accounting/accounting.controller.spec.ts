import { AccountingController } from './accounting.controller';

describe('AccountingController — RBAC permission mode', () => {
  function getHandlerMeta(method: string) {
    const descriptor = Object.getOwnPropertyDescriptor(AccountingController.prototype, method);
    const handler = descriptor?.value;
    expect(handler).toBeDefined();
    return Reflect.getMetadata('permissions', handler);
  }

  it('getSummary uses OR mode with accounting.accounts.read and reports.finance', () => {
    const meta = getHandlerMeta('getSummary');
    expect(meta).toEqual({
      permissions: ['accounting.accounts.read', 'reports.finance'],
      mode: 'OR',
    });
  });

  it('getGeneralLedger uses OR mode with accounting.journal.read and reports.finance', () => {
    const meta = getHandlerMeta('getGeneralLedger');
    expect(meta).toEqual({
      permissions: ['accounting.journal.read', 'reports.finance'],
      mode: 'OR',
    });
  });

  it('getTrialBalance uses OR mode with accounting.journal.read and reports.finance', () => {
    const meta = getHandlerMeta('getTrialBalance');
    expect(meta).toEqual({
      permissions: ['accounting.journal.read', 'reports.finance'],
      mode: 'OR',
    });
  });

  it('findAllAccounts retains single-permission AND mode (accounting.accounts.read only)', () => {
    const meta = getHandlerMeta('findAllAccounts');
    expect(meta).toEqual({
      permissions: ['accounting.accounts.read'],
      mode: 'AND',
    });
  });
});
