'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Building2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { ForbiddenState } from '@/components/rbac/forbidden-state';
import { RequirePermission } from '@/components/rbac/require-permission';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { DEPARTMENTS_READ, DEPARTMENTS_CREATE, DEPARTMENTS_UPDATE, DEPARTMENTS_DELETE } from '@/lib/permissions';
import { useToast } from '@/components/ui/use-toast';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  type Department,
  type CreateDepartmentData,
} from '@/lib/api/departments';
import { DepartmentTable } from '@/components/departments/departments-table';
import { useMutation } from '@tanstack/react-query';

export default function DepartmentsPage() {
  const { hasPermission, isLoaded } = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const canRead = isLoaded && hasPermission(DEPARTMENTS_READ);
  const canCreate = isLoaded && hasPermission(DEPARTMENTS_CREATE);
  const canUpdate = isLoaded && hasPermission(DEPARTMENTS_UPDATE);
  const canDelete = isLoaded && hasPermission(DEPARTMENTS_DELETE);

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');

  const deptQuery = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => getDepartments(),
    enabled: canRead,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['departments'] });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateDepartmentData) => createDepartment(data),
    onSuccess: () => {
      toast({ title: 'Department created' });
      invalidate();
      resetForm();
      setCreateOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create department', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; code?: string } }) => updateDepartment(id, data),
    onSuccess: () => {
      toast({ title: 'Department updated' });
      invalidate();
      resetForm();
      setEditDept(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update department', description: error.message, variant: 'destructive' });
    },
  });

  function resetForm() {
    setFormName('');
    setFormCode('');
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  function openEdit(dept: Department) {
    setFormName(dept.name);
    setFormCode(dept.code);
    setEditDept(dept);
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) return;
    createMutation.mutate({ name: formName.trim(), code: formCode.trim() });
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editDept || !formName.trim() || !formCode.trim()) return;
    updateMutation.mutate({ id: editDept.id, data: { name: formName.trim(), code: formCode.trim() } });
  }

  if (!isLoaded) return <DashboardSkeleton />;

  if (!canRead) {
    return (
      <ForbiddenState
        title="Access restricted"
        description="You don't have permission to view departments. Contact your organization administrator."
      />
    );
  }

  const departments = (deptQuery.data ?? []).filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q);
  });

  return (
    <RequirePermission permission={DEPARTMENTS_READ}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="text-muted-foreground">Manage organizational departments.</p>
        </div>
        {canCreate && (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Department
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {deptQuery.isLoading ? (
        <DashboardSkeleton />
      ) : deptQuery.error ? (
        <DashboardError status={500} message={(deptQuery.error as Error).message} />
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 py-16">
          <Building2 className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">No departments found</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {search ? 'Try adjusting your search.' : 'Create your first department to get started.'}
          </p>
        </div>
      ) : (
        <DepartmentTable
          departments={departments}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
        />
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) { resetForm(); setCreateOpen(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Department</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Engineering" required />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="e.g. ENG" required />
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { resetForm(); setCreateOpen(false); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Department'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDept !== null} onOpenChange={(v) => { if (!v) { resetForm(); setEditDept(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} required />
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { resetForm(); setEditDept(null); }}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        entityName={deleteTarget?.name ?? null}
        title="Delete Department"
        description="This action cannot be undone. The department will be permanently removed."
        buttonLabel="Delete Department"
        successTitle="Department deleted"
        errorFallback="Failed to delete department."
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={invalidate}
        deleteFn={() => deleteTarget ? deleteDepartment(deleteTarget.id) : Promise.resolve()}
      />
    </div>
    </RequirePermission>
  );
}
