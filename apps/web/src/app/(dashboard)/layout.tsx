'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { AiCopilotDock } from '@/components/workspace/ai-copilot-dock';
import { AppSidebar } from '@/components/workspace/app-sidebar';
import { AppTopbar } from '@/components/workspace/app-topbar';
import { CommandPalette } from '@/components/workspace/command-palette';
import { useCopilotActions } from '@/core/workspace/copilot-actions';
import { WorkspaceProvider } from '@/core/workspace/workspace-context';
import { useShellStore } from '@/core/layout/shell-store';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/providers/auth-provider';
import { OrganizationThemeProvider } from '@/providers/organization-theme-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <OrganizationThemeProvider>
        <WorkspaceProvider>
          <Shell>{children}</Shell>
        </WorkspaceProvider>
      </OrganizationThemeProvider>
    </AuthProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const collapsed = useShellStore((s) => s.sidebarCollapsed);
  const mobileOpen = useShellStore((s) => s.mobileSidebarOpen);
  const runCommand = useCopilotActions();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[400px] w-[400px] rounded-full bg-slate-400/[0.05] dark:bg-white/[0.02] blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[320px] w-[320px] rounded-full bg-slate-500/[0.04] dark:bg-white/[0.02] blur-[120px]" />
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => useShellStore.getState().setMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60 lg:hidden"
          />
        )}
      </AnimatePresence>

      <AppSidebar />

      <main
        className={cn(
          'relative z-10 flex h-full flex-1 flex-col transition-all duration-300 ease-out',
          collapsed ? 'lg:ml-[80px]' : 'lg:ml-[300px]',
        )}
      >
        <AppTopbar />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1920px] p-4 lg:p-6">{children}</div>
        </div>
      </main>

      <CommandPalette onCommand={runCommand} />
      <AiCopilotDock onCommand={runCommand} />
    </div>
  );
}
