import { api } from './client';
import { API_ROUTES } from './routes';

export interface PublicOrganization {
  id: string;
  slug: string;
  name: string;
  brand: Record<string, unknown>;
}

export interface EmailLookupResult {
  found: boolean;
  organization?: PublicOrganization;
}

/** Resolves an organization's identity + branding by slug (subdomain or /company/:slug). */
export async function getOrgBySlug(slug: string, signal?: AbortSignal): Promise<PublicOrganization> {
  const response = await api.get<PublicOrganization>(
    API_ROUTES.ORGANIZATIONS.BY_SLUG.replace('{slug}', encodeURIComponent(slug)),
    { signal },
  );
  return response.data;
}

/** Resolves the organization a user belongs to from their email address. */
export async function getOrgByEmail(email: string, signal?: AbortSignal): Promise<EmailLookupResult> {
  const response = await api.post<EmailLookupResult>(
    API_ROUTES.ORGANIZATIONS.BY_EMAIL,
    { email },
    { signal },
  );
  return response.data;
}
