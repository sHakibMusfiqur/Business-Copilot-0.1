'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, FileSpreadsheet, FileText, Settings2, UploadCloud, X } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { SectionCard } from '@/components/setup/section-card';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { markChecklistComplete } from '@/lib/onboarding-api';
import { getOnboardingSession } from '@/lib/session-storage';
import { queryClient } from '@/lib/query-client';

const IMPORT_TYPES = [
  { value: 'customers', label: 'Customers', desc: 'Import customer records and contact information' },
  { value: 'products', label: 'Products', desc: 'Import product catalog with pricing and details' },
  { value: 'suppliers', label: 'Suppliers', desc: 'Import supplier information and vendor details' },
  { value: 'inventory', label: 'Inventory', desc: 'Import current inventory stock levels' },
  { value: 'chart-of-accounts', label: 'Chart of Accounts', desc: 'Import accounting chart of accounts' },
];

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const selectClass =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface SelectedFile {
  name: string;
  size: number;
}

export default function ImportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [fileFormat, setFileFormat] = useState('CSV');
  const [delimiter, setDelimiter] = useState('Comma');
  const [skipFirstRow, setSkipFirstRow] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const validateFile = (f: File): string | null => {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type. Use CSV, XLSX, or XLS.`;
    }
    if (f.size > MAX_FILE_SIZE) {
      return `File exceeds the 50MB limit.`;
    }
    return null;
  };

  const acceptFile = (f: File) => {
    const err = validateFile(f);
    if (err) {
      setFile(null);
      setFileError(err);
      return;
    }
    setFileError(null);
    setFile({ name: f.name, size: f.size });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  const handleSave = async () => {
    if (!selectedType) {
      toast({ title: 'Select an import type', description: 'Please choose what type of data you want to import.', variant: 'destructive' });
      return;
    }
    if (!file) {
      toast({ title: 'Select a file', description: 'Please choose a CSV, XLSX, or XLS file to import.', variant: 'destructive' });
      return;
    }
    if (fileError) {
      toast({ title: 'Fix your file', description: fileError, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await api.post('/import/start', {
        importType: selectedType,
        fileFormat,
        delimiter,
        skipFirstRow,
        updateExisting,
        fileName: file.name,
        fileSize: file.size,
      });
    } catch (err) {
      toast({
        title: 'Could not start import',
        description: err instanceof Error ? err.message : 'Failed to start import.',
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    try {
      const session = getOnboardingSession();
      if (session?.id) {
        await markChecklistComplete(session.id, 'data');
        queryClient.invalidateQueries({ queryKey: ['onboarding', 'checklist-progress'] });
      }
    } catch {
      // best-effort
    }

    toast({ title: 'Import started', description: 'Your data import has been initiated.', variant: 'success' });
    setSaving(false);
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
      saveLabel="Start Import"
    >
      <SectionCard
        title="Import Type"
        description="Select what type of data you want to import"
        icon={<Database className="h-4 w-4" />}
      >
        <div className="grid gap-2">
          {IMPORT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setSelectedType(type.value)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:border-primary/50',
                selectedType === type.value
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-200/60 dark:border-white/10',
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  selectedType === type.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{type.label}</p>
                <p className="text-xs text-muted-foreground">{type.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Your File"
        description="Choose the file you want to import"
        icon={<FileSpreadsheet className="h-4 w-4" />}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload import file"
          onClick={() => document.getElementById('import-file-input')?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              document.getElementById('import-file-input')?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center transition-colors',
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 bg-muted/40 hover:border-primary/50 hover:bg-primary/5',
          )}
        >
          <UploadCloud className={cn('h-8 w-8', dragging ? 'text-primary' : 'text-muted-foreground')} />
          <p className="text-sm font-medium text-foreground">Drop your file here or click to browse</p>
          <p className="text-xs text-muted-foreground">Supports CSV, XLSX, and XLS files up to 50MB</p>
          <input
            id="import-file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) acceptFile(f);
              e.target.value = '';
            }}
          />
        </div>

        {fileError && <p className="mt-3 text-xs text-destructive">{fileError}</p>}

        {file && !fileError && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-muted/30 px-4 py-3 dark:border-white/10">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="File Settings"
        description="Configure how your file should be read"
        icon={<Settings2 className="h-4 w-4" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fileFormat" className="text-sm font-medium">
              File Format *
            </Label>
            <select
              id="fileFormat"
              value={fileFormat}
              onChange={(e) => setFileFormat(e.target.value)}
              className={selectClass}
            >
              <option value="CSV">CSV (.csv)</option>
              <option value="XLSX">Excel (.xlsx)</option>
              <option value="XLS">Excel (.xls)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delimiter" className="text-sm font-medium">
              Delimiter *
            </Label>
            <select
              id="delimiter"
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value)}
              className={selectClass}
            >
              <option value="Comma">Comma (,)</option>
              <option value="Tab">Tab</option>
              <option value="Semicolon">Semicolon (;)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 divide-y divide-slate-200/60 dark:divide-white/10">
          <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-foreground">Skip First Row</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Treat the first row as column headers</p>
            </div>
            <Switch checked={skipFirstRow} onCheckedChange={setSkipFirstRow} aria-label="Skip First Row" />
          </div>
          <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-foreground">Update Existing Records</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Update records that already exist by matching key fields</p>
            </div>
            <Switch checked={updateExisting} onCheckedChange={setUpdateExisting} aria-label="Update Existing Records" />
          </div>
        </div>
      </SectionCard>
    </SetupPageShell>
  );
}
