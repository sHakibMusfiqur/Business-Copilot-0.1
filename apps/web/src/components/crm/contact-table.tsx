'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  ContactRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/utils';

import type { ContactListItem, CrmListMeta, ContactStatus } from '@/lib/api';

interface ContactTableProps {
  contacts: ContactListItem[];
  meta: CrmListMeta | null;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  isLoading: boolean;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
  onEdit?: (contact: ContactListItem) => void;
  onDelete?: (contact: ContactListItem) => void;
}

export const CONTACT_STATUS_STYLES: Record<ContactStatus, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  INACTIVE: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

function SortIcon({ field, sortBy, sortOrder }: { field: string; sortBy: string; sortOrder: string }) {
  if (field !== sortBy) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
  return sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <ContactRound className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        No contacts match your filters. Try adjusting your search or create a new contact.
      </p>
    </div>
  );
}

export function ContactTable({
  contacts,
  meta,
  search,
  sortBy,
  sortOrder,
  isLoading,
  onSearchChange,
  onPageChange,
  onSort,
  onEdit,
  onDelete,
}: ContactTableProps) {
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, onSearchChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or company..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            aria-label="Search contacts"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : contacts.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th
                      className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => onSort('firstName')}
                    >
                      <span className="inline-flex items-center">
                        Name
                        <SortIcon field="firstName" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Company</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Owner</th>
                    <th
                      className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => onSort('email')}
                    >
                      <span className="inline-flex items-center">
                        Email
                        <SortIcon field="email" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Phone</th>
                    <th
                      className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => onSort('createdAt')}
                    >
                      <span className="inline-flex items-center">
                        Created
                        <SortIcon field="createdAt" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className="w-[60px] p-4" />
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <p className="text-sm font-medium">
                          {contact.firstName} {contact.lastName}
                        </p>
                        {contact.jobTitle && (
                          <p className="text-xs text-muted-foreground">{contact.jobTitle}</p>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {contact.companyRecord?.name ?? contact.company ?? '\u2014'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CONTACT_STATUS_STYLES[contact.status]}`}
                        >
                          {contact.status.charAt(0) + contact.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{contact.owner?.name ?? '\u2014'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{contact.email ?? '\u2014'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{contact.phone ?? '\u2014'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{formatDate(contact.createdAt)}</span>
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Contact actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {onEdit && <DropdownMenuItem onClick={() => onEdit(contact)}>Edit contact</DropdownMenuItem>}
                            {onDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDelete(contact)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  Delete contact
                                </DropdownMenuItem>
                              </>
                            )}
                            {!onEdit && !onDelete && <DropdownMenuItem disabled>View only</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages} ({meta.total} total)
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => onPageChange(1)} aria-label="First page">
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">{meta.page} / {meta.totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)} aria-label="Next page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.totalPages)} aria-label="Last page">
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
