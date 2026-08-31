'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Database, FileSpreadsheet, FileText, Settings2, UploadCloud, X, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { SectionCard } from '@/components/setup/section-card';
import { SetupPageShell } from '@/components/setup/setup-page-shell';
import { api } from '@/lib/api';
import { API_ROUTES } from '@/lib/api/routes';
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

interface ImportJobResult {
  id: string;
  status: string;
}

interface RowError {
  row: number;
  field?: string;
  message: string;
  value?: unknown;
}

interface ImportJobStatus {
  id: string;
  importType: string;
  fileName: string;
  status: string;
  totalRows: number;
  importedCount: number;
  errorCount: number;
  errors: RowError[] | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export default function ImportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [saving, setSaving] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [fileFormat, setFileFormat] = useState('CSV');
  const [delimiter, setDelimiter] = useState('Comma');
  const [skipFirstRow, setSkipFirstRow] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Import result state
  const [importResult, setImportResult] = useState<ImportJobResult | null>(null);
  const [jobStatus, setJobStatus] = useState<ImportJobStatus | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const pollJobStatus = useCallback(async (jobId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get<ImportJobStatus>(`${API_ROUTES.IMPORT.ROOT}/${jobId}`);
        setJobStatus(res.data);

        if (res.data.status === 'COMPLETED' || res.data.status === 'FAILED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setSaving(false);

          if (res.data.status === 'COMPLETED') {
            toast({
              title: 'Import completed',
              description: `${res.data.importedCount} records imported${res.data.errorCount > 0 ? ` with ${res.data.errorCount} errors` : ''}.`,
              variant: res.data.errorCount > 0 ? 'default' : 'success',
            });
          } else {
            toast({
              title: 'Import failed',
              description: 'The import process encountered an error.',
              variant: 'destructive',
            });
          }
        }
      } catch {
        setPollingError('Failed to fetch import status');
        if (pollingRef.current) clearInterval(pollingRef.current);
        setSaving(false);
      }
    }, 2000);
  }, [toast]);

  const validateFile = (f: File): string | null => {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return 'Unsupported file type. Use CSV, XLSX, or XLS.';
    }
    if (f.size > MAX_FILE_SIZE) {
      return 'File exceeds the 50MB limit.';
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
    setFile(f);
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
    setImportResult(null);
    setJobStatus(null);
    setPollingError(null);
    setShowErrors(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('importType', selectedType);
      formData.append('fileFormat', fileFormat);
      formData.append('delimiter', delimiter);
      formData.append('skipFirstRow', String(skipFirstRow));
      formData.append('updateExisting', String(updateExisting));

      const res = await api.post<ImportJobResult>(API_ROUTES.IMPORT.START, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setImportResult(res.data);
      pollJobStatus(res.data.id);

      // Best-effort onboarding
      try {
        const session = getOnboardingSession();
        if (session?.id) {
          await markChecklistComplete(session.id, 'data');
          queryClient.invalidateQueries({ queryKey: ['onboarding', 'checklist-progress'] });
        }
      } catch {
        // best-effort
      }
    } catch (err) {
      toast({
        title: 'Could not start import',
        description: err instanceof Error ? err.message : 'Failed to start import.',
        variant: 'destructive',
      });
      setSaving(false);
    }
  };

  const isProcessing = saving || (importResult?.status !== undefined && jobStatus?.status !== 'COMPLETED' && jobStatus?.status !== 'FAILED');

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
      saveLabel={isProcessing ? 'Processing...' : 'Start Import'}
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
              disabled={isProcessing}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:border-primary/50',
                selectedType === type.value
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-200/60 dark:border-white/10',
                isProcessing && 'opacity-50 cursor-not-allowed',
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
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!isProcessing) fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isProcessing) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center transition-colors',
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 bg-muted/40 hover:border-primary/50 hover:bg-primary/5',
            isProcessing && 'opacity-50 cursor-not-allowed',
          )}
        >
          <UploadCloud className={cn('h-8 w-8', dragging ? 'text-primary' : 'text-muted-foreground')} />
          <p className="text-sm font-medium text-foreground">Drop your file here or click to browse</p>
          <p className="text-xs text-muted-foreground">Supports CSV, XLSX, and XLS files up to 50MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            disabled={isProcessing}
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
            {!isProcessing && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            )}
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
              disabled={isProcessing}
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
              disabled={isProcessing}
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
            <Switch checked={skipFirstRow} onCheckedChange={setSkipFirstRow} disabled={isProcessing} aria-label="Skip First Row" />
          </div>
          <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-foreground">Update Existing Records</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Update records that already exist by matching key fields</p>
            </div>
            <Switch checked={updateExisting} onCheckedChange={setUpdateExisting} disabled={isProcessing} aria-label="Update Existing Records" />
          </div>
        </div>
      </SectionCard>

      {/* Import Progress / Results */}
      {(importResult || jobStatus) && (
        <SectionCard
          title="Import Status"
          description={jobStatus?.status === 'PROCESSING' ? 'Your import is being processed...' : 'Import results'}
          icon={jobStatus?.status === 'PROCESSING'
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : jobStatus?.status === 'COMPLETED'
              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
              : jobStatus?.status === 'FAILED'
                ? <AlertCircle className="h-4 w-4 text-destructive" />
                : <Loader2 className="h-4 w-4 animate-spin" />
          }
        >
          {/* Status indicator */}
          {jobStatus?.status === 'PROCESSING' && (
            <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Processing your import... This may take a moment for large files.
              </p>
            </div>
          )}

          {jobStatus?.status === 'FAILED' && (
            <div className="flex items-center gap-3 rounded-xl border border-destructive/50 bg-destructive/5 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">
                Import failed. {pollingError || 'An unexpected error occurred.'}
              </p>
            </div>
          )}

          {/* Results summary */}
          {jobStatus && (jobStatus.status === 'COMPLETED' || jobStatus.status === 'FAILED') && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200/60 bg-muted/30 p-3 text-center dark:border-white/10">
                  <p className="text-2xl font-bold text-foreground">{jobStatus.totalRows}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center dark:border-green-800 dark:bg-green-950">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{jobStatus.importedCount}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Imported</p>
                </div>
                <div className={cn(
                  'rounded-xl border p-3 text-center',
                  jobStatus.errorCount > 0
                    ? 'border-destructive/50 bg-destructive/5'
                    : 'border-slate-200/60 bg-muted/30 dark:border-white/10',
                )}>
                  <p className={cn('text-2xl font-bold', jobStatus.errorCount > 0 ? 'text-destructive' : 'text-foreground')}>
                    {jobStatus.errorCount}
                  </p>
                  <p className={cn('text-xs', jobStatus.errorCount > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    Errors
                  </p>
                </div>
              </div>

              {/* Row-level errors */}
              {jobStatus.errors && jobStatus.errors.length > 0 && (
                <div className="rounded-xl border border-destructive/50 bg-destructive/5">
                  <button
                    type="button"
                    onClick={() => setShowErrors(!showErrors)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium text-destructive">
                        {jobStatus.errors.length} row-level error{jobStatus.errors.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {showErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {showErrors && (
                    <div className="max-h-60 overflow-y-auto border-t border-destructive/20 px-4 pb-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Row</th>
                            <th className="pb-2 pr-4 font-medium">Field</th>
                            <th className="pb-2 font-medium">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobStatus.errors.slice(0, 100).map((err, idx) => (
                            <tr key={idx} className="border-t border-destructive/10">
                              <td className="py-1.5 pr-4 text-foreground">{err.row}</td>
                              <td className="py-1.5 pr-4 text-muted-foreground">{err.field || '-'}</td>
                              <td className="py-1.5 text-destructive">{err.message}</td>
                            </tr>
                          ))}
                          {jobStatus.errors.length > 100 && (
                            <tr>
                              <td colSpan={3} className="py-1.5 text-center text-muted-foreground">
                                ...and {jobStatus.errors.length - 100} more errors
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </SectionCard>
      )}
    </SetupPageShell>
  );
}
