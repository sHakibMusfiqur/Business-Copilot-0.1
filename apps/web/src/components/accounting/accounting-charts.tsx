'use client';

import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface MonthlyData {
  month: string;
  revenue: number;
  expense: number;
}

interface AccountingChartsProps {
  monthlyData: MonthlyData[];
}

function CustomTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-xl">
      <p className="text-sm font-medium mb-2">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {formatCurrency(Number(entry.value))}
        </p>
      ))}
    </div>
  );
}

export function AccountingCharts({ monthlyData }: AccountingChartsProps) {
  if (monthlyData.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-sm text-muted-foreground">No transaction data available for charts.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-medium mb-4">Monthly Revenue vs Expense</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={monthlyData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 12 }} />
          <YAxis className="text-xs" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
