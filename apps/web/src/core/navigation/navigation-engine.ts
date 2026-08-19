import type { ModuleManifest } from '@/core/modules/types';
import { DEFAULT_FAVORITES, MODULE_CATEGORIES } from '@/core/modules/categories';

import type { NavItem, NavSection } from './types';

function hasAny(permissions: string[], required: string[]): boolean {
  return required.length === 0 || required.some((p) => permissions.includes(p));
}

export function buildNavigation(modules: ModuleManifest[], permissions: string[]): NavSection[] {
  const grouped = new Map<string, ModuleManifest[]>();
  for (const mod of modules) {
    if (mod.id === 'dashboard') continue;
    if (mod.navDisabled) continue;
    if (!hasAny(permissions, mod.permissions)) continue;
    const list = grouped.get(mod.category) ?? [];
    list.push(mod);
    grouped.set(mod.category, list);
  }

  const navigation: NavSection[] = [];
  for (const category of MODULE_CATEGORIES) {
    const items: NavItem[] = (grouped.get(category) ?? []).map((m) => ({
      id: m.id,
      label: m.name,
      href: m.route,
      icon: m.icon,
      permission: m.permissions[0],
      module: m.id,
      pinned: m.id === 'dashboard' || DEFAULT_FAVORITES.includes(m.id),
      favorite: m.id === 'dashboard',
    }));
    if (items.length > 0) {
      navigation.push({ id: category, label: category, items });
    }
  }

  return navigation;
}
