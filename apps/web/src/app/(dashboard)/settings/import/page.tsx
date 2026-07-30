'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Database, FileText, Upload } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';

const schema = z.object({
  importType: z.string().min(1, 'Import type is required'),
  fileFormat: z.string().min(1, 'File format is required'),
  delimiter: z.string().min(1, 'Delimiter is required'),
  skipFirstRow: z.boolean(),
  updateExisting: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const selectClass = 'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const IMPORT_TYPES = [
  { value: 'customers', label: 'Customers', desc: 'Import customer records and contact information' },
  { value: 'products', label: 'Products', desc: 'Import product catalog with pricing and details' },
  { value: 'suppliers', label: 'Suppliers', desc: 'Import supplier information and vendor details' },
  { value: 'inventory', label: 'Inventory', desc: 'Import current inventory stock levels' },
  { value: 'chart-of-accounts', label: 'Chart of Accounts', desc: 'Import accounting chart of accounts' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  );
}

export default function ImportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedType, setSelectedType] = useState('');

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      importType: '',
      fileFormat: 'CSV',
      delimiter: 'Comma',
      skipFirstRow: true,
      updateExisting: false,
    },
  });

  const { register, watch, setValue } = form;

  const handleSave = async () => {
    if (!selectedType) {
      toast({ title: 'Error', description: 'Please select an import type.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/import/start', { ...form.getValues(), importType: selectedType });
      const session = getOnboardingSession();
      if (session?.id) {
        await markChecklistComplete(session.id, 'data');
      }
      setSaved(true);
      toast({ title: 'Import started', description: 'Your data import has been initiated.', variant: 'default' });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to start import.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SetupPageShell
      title="Import Data"
      description="Import your existing data from other systems and spreadsheets"
      breadcrumb={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Settings' },
        { label: 'Import Data' },
      ]}
      onSave={handleSave}
      onCancel={() => router.back()}
      saving={saving}
      saved={saved}
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Import Type</h3>
            <p className="text-xs text-muted-foreground mt-1">Select what type of data you want to import</p>
          </div>
        </div>

        <div className="grid gap-2">
          {IMPORT_TYPES.map((type) => (
            <Card
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                selectedType === type.value ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  selectedType === type.value ? "bg-primary/10" : "bg-muted"
                )}>
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{type.label}</p>
                  <p className="text-xs text-muted-foreground">{type.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">File Settings</h3>
          <p className="text-xs text-muted-foreground mt-1">Configure your import file settings</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fileFormat">File Format *</Label>
            <select id="fileFormat" {...register('fileFormat')} className={selectClass}>
              <option value="CSV">CSV (.csv)</option>
              <option value="XLSX">Excel (.xlsx)</option>
              <option value="XLS">Excel (.xls)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delimiter">Delimiter *</Label>
            <select id="delimiter" {...register('delimiter')} className={selectClass}>
              <option value="Comma">Comma (,)</option>
              <option value="Tab">Tab</option>
              <option value="Semicolon">Semicolon (;)</option>
            </select>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Toggle checked={watch('skipFirstRow')} onChange={() => setValue('skipFirstRow', !watch('skipFirstRow'))} />
            <div>
              <p className="text-sm font-medium">Skip First Row</p>
              <p className="text-xs text-muted-foreground">Treat the first row as column headers</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Toggle checked={watch('updateExisting')} onChange={() => setValue('updateExisting', !watch('updateExisting'))} />
            <div>
              <p className="text-sm font-medium">Update Existing Records</p>
              <p className="text-xs text-muted-foreground">Update records that already exist by matching key fields</p>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/50 p-8 text-center">
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium text-foreground">Drop your file here or click to browse</p>
        <p className="mt-1 text-xs text-muted-foreground">Supports CSV, XLSX, and XLS files up to 50MB</p>
        <Input type="file" className="mt-4 mx-auto max-w-xs" accept=".csv,.xlsx,.xls" />
      </div>
    </SetupPageShell>
  );
}
