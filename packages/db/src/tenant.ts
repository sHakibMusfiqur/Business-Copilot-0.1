import { Prisma } from '@prisma/client';

export const RLS_ORG_VAR = 'app.current_org';
export const RLS_USER_VAR = 'app.current_user';
export const RLS_ENABLED_VAR = 'app.rls_enabled';

export interface TenantScope {
  organizationId: string;
  userId?: string;
}

export const SCOPED_MODELS = [
  'Category',
  'Warehouse',
  'Inventory',
  'File',
] as const;

export type ScopedModel = (typeof SCOPED_MODELS)[number];

type SqlRunner = { $executeRaw: (query: Prisma.Sql) => Promise<unknown> };

export type TransactionalClient<Ctx> = {
  $transaction: (
    fn: (tx: Ctx) => Promise<unknown>,
    options?: Prisma.TransactionOptions,
  ) => Promise<unknown>;
};

async function setContextVar(tx: SqlRunner, name: string, value: string): Promise<void> {
  await tx.$executeRaw(
    Prisma.sql`SELECT set_config(${name}, ${value}, true)`,
  );
}

export async function withTenantScope<T, Ctx>(
  client: TransactionalClient<Ctx>,
  scope: TenantScope,
  fn: (tx: Ctx) => Promise<T>,
): Promise<T> {
  const run = async (tx: Ctx): Promise<T> => {
    const runner = tx as unknown as SqlRunner;
    await setContextVar(runner, RLS_ORG_VAR, scope.organizationId);
    if (scope.userId) {
      await setContextVar(runner, RLS_USER_VAR, scope.userId);
    }
    await setContextVar(runner, RLS_ENABLED_VAR, 'on');
    return fn(tx);
  };
  return client.$transaction(async (tx) => run(tx)) as Promise<T>;
}

export function requireTenantScope<T extends { organizationId?: string | null }>(
  record: T | null | undefined,
  organizationId: string,
  label: string,
): asserts record is T & { organizationId: string } {
  if (!record || record.organizationId !== organizationId) {
    throw new Error(`Tenant isolation violation on "${label}"`);
  }
}

export function tenantExtension(scope: TenantScope) {
  const queries: Record<string, unknown> = {};

  for (const model of SCOPED_MODELS) {
    queries[model] = {
      query: {
        create({
          args,
          query,
        }: {
          args: { data: Record<string, unknown> };
          query: (args: unknown) => Promise<unknown>;
        }) {
          args.data = { ...args.data, organizationId: scope.organizationId };
          return query(args);
        },
        createMany({
          args,
          query,
        }: {
          args: { data: Record<string, unknown> | Record<string, unknown>[] };
          query: (args: unknown) => Promise<unknown>;
        }) {
          const items = Array.isArray(args.data) ? args.data : [args.data];
          args.data = items.map((item) => ({
            ...item,
            organizationId: scope.organizationId,
          }));
          return query(args);
        },
        upsert({
          args,
          query,
        }: {
          args: {
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          };
          query: (args: unknown) => Promise<unknown>;
        }) {
          args.create = { ...args.create, organizationId: scope.organizationId };
          args.update = { ...args.update, organizationId: scope.organizationId };
          return query(args);
        },
      },
    };
  }

  return Prisma.defineExtension({
    name: 'bc-tenant-scope',
    query: queries,
  }) as unknown as (client: any) => any;
}