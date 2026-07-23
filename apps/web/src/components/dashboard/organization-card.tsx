import Image from 'next/image';

import { Building2 } from 'lucide-react';

import { formatDate } from '@/lib/utils';
import type { DashboardOrganization } from './types';

interface OrganizationCardProps {
  organization: DashboardOrganization;
}

export function OrganizationCard({ organization }: OrganizationCardProps) {
  return (
    <div className="glass-card rounded-xl p-5 flex items-center gap-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        {organization.logo ? (
          <div className="relative h-10 w-10">
            <Image
              src={organization.logo}
              alt={organization.name}
              fill
              className="rounded-lg object-cover"
              unoptimized
            />
          </div>
        ) : (
          <Building2 className="h-7 w-7 text-primary" />
        )}
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold truncate">{organization.name}</h2>
        <p className="text-sm text-muted-foreground">
          Created {formatDate(organization.createdAt)}
        </p>
      </div>
    </div>
  );
}
