'use client';

import { useMemo, useRef } from 'react';

import { createDashboardEngine } from '@/core/dashboard/dashboard-engine';
import { buildDashboardContext, type DashboardContextExtras } from '@/core/dashboard/widget-context';
import type { DashboardEngine, DashboardManifest, WidgetDeclaration } from '@/core/dashboard/dashboard-engine';
import type { ResolvedWorkspace, WidgetDefinition } from '@/core/workspace/types';
import { useWorkspace } from '@/core/workspace/workspace-context';

/** Extra context surfaced by the dashboard hook. */
export type UseDashboardOptions = DashboardContextExtras;

export interface UseDashboardResult {
  readonly engine: DashboardEngine;
  readonly manifest: DashboardManifest;
  readonly context: DashboardManifest['context'];
}

export function useDashboard(): UseDashboardResult {
  const { resolved } = useWorkspace();

  const engineRef = useRef<DashboardEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createDashboardEngine();
  }
  const engine = engineRef.current;

  
  const manifest = useMemo(
    () => resolveDashboardManifest(engine, resolved),
    [engine, resolved],
  );

  return {
    engine,
    manifest,
    context: manifest.context,
  };
}


function resolveDashboardManifest(
  engine: DashboardEngine,
  resolved: ResolvedWorkspace,
): DashboardManifest {
  const declarations = toDeclarations(resolved.manifest?.widgets ?? []);
  for (const declaration of declarations) {
    engine.registerWidget(declaration);
  }

  const context = buildDashboardContext(resolved);
  return engine.resolve(context);
}

/** Adapt the legacy widget definitions into engine declarations (backward compat). */
function toDeclarations(widgets: readonly WidgetDefinition[]): WidgetDeclaration[] {
  return widgets.map((widget) => {
    const id = `${widget.source ?? widget.key}::${widget.zone}`;
    return {
      id,
      key: widget.key,
      zone: widget.zone,
      span: widget.span,
      source: widget.source ?? widget.key,
      order: 0,
      priority: 0,
      visibility: {
        roles: widget.roles,
        industries: widget.industries,
        permission: widget.permission,
        module: widget.module,
        aiRequired: widget.aiRequired,
      },
    };
  });
}

export type { WidgetDeclaration, DashboardEngine, DashboardManifest };