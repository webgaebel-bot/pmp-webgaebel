import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/hooks/useSidebar';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const {
    isCollapsed,
    isMobileOpen,
    isMobile,
    toggleCollapsed,
    toggleMobile,
    closeMobile,
  } = useSidebar();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Calculate main content margin based on sidebar state
  const getMainMargin = () => {
    if (isMobile) return 'ml-0';
    return isCollapsed ? 'ml-16' : 'ml-64';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        isMobile={isMobile}
        onToggleCollapse={toggleCollapsed}
        onCloseMobile={closeMobile}
      />

      {/* Main Content */}
      <div className={cn(
        'transition-[margin] duration-300 ease-in-out',
        getMainMargin()
      )}>
        <Topbar
          isMobile={isMobile}
          isCollapsed={isCollapsed}
          onToggleMobile={toggleMobile}
          onToggleCollapse={toggleCollapsed}
        />
        
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
