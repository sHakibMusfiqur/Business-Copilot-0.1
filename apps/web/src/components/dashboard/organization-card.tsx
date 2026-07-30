import Image from 'next/image';

import { Building2, CalendarDays } from 'lucide-react';

import { formatDate } from '@/lib/utils';
import type { DashboardOrganization } from './types';

interface OrganizationCardProps {
  organization: DashboardOrganization;
}

export function OrganizationCard({ organization }: OrganizationCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex items-center gap-4 group cursor-default">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-50 group-hover:bg-red-50 transition-colors">
        {organization.logo ? (
          <div className="relative h-9 w-9">
            <Image
              src={organization.logo}
              alt={organization.name}
              fill
              className="rounded-xl object-cover"
              unoptimized
            />
          </div>
        ) : (
          <Building2 className="h-7 w-7 text-slate-500 group-hover:text-red-500 transition-colors" />
        )}
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-slate-900 truncate">{organization.name}</h2>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="inline-flex items-center gap-1 text-sm text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            Created {formatDate(organization.createdAt)}
          </span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            Active
          </span>
        </div>
      </div>
    </div>
  );
}
