'use client';

import { Building2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Department } from './departments-types';

interface DepartmentTableProps {
  departments: Department[];
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (dept: Department) => void;
  onDelete: (dept: Department) => void;
}

export function DepartmentTable({
  departments,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: DepartmentTableProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Department</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              {(canUpdate || canDelete) && (
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <tr key={dept.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{dept.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{dept.code}</td>
                <td className="px-4 py-3">
                  {dept.shared ? (
                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                      Shared
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Organization
                    </span>
                  )}
                </td>
                {(canUpdate || canDelete) && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canUpdate && !dept.shared && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(dept)}>
                          Edit
                        </Button>
                      )}
                      {canDelete && !dept.shared && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDelete(dept)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
