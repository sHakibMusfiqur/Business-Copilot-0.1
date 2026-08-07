import type { BoundWidget } from './widget-registry';
import type { DashboardContext } from './widget-types';

export function evaluateVisibility(
  widget: BoundWidget,
  context: DashboardContext,
): boolean {
  const visibility = widget.visibility;
  if (!visibility) return true;

  if (visibility.roles && !visibility.roles.includes(context.role)) return false;
  if (visibility.industries && !visibility.industries.includes(context.industry)) return false;
  if (visibility.aiRequired && !context.aiEnabled) return false;

  if (visibility.permission && visibility.permission.length > 0) {
    if (!hasAny(context.permissions, visibility.permission)) return false;
  }

  if (visibility.module && context.enabledModules) {
    if (!context.enabledModules.includes(visibility.module)) return false;
  }

  if (visibility.capabilities && visibility.capabilities.length > 0) {
    if (!hasAny(context.enabledCapabilities, visibility.capabilities)) return false;
  }

  if (visibility.plugins && visibility.plugins.length > 0) {
    const plugins = context.installedPlugins ?? [];
    if (!visibility.plugins.every((p) => plugins.includes(p))) return false;
  }

  if (visibility.features && visibility.features.length > 0) {
    const features = context.enabledFeatures ?? [];
    if (!visibility.features.every((f) => features.includes(f))) return false;
  }

  if (visibility.plan && visibility.plan !== context.plan) return false;
  if (visibility.environment && visibility.environment !== context.environment) return false;

  return true;
}

function hasAny(grants: readonly string[], required: readonly string[]): boolean {
  const grantSet = new Set(grants);
  return required.some((permission) => grantSet.has(permission));
}