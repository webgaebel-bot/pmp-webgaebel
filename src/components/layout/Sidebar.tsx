import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Shield,
  Activity,
  Settings,
  ChevronDown,
  FileText,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  X,
  Mail,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  permission?: string;
  children?: NavItem[];
}

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  isMobile: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    permission: 'dashboard.view',
  },
  {
    label: 'Projects',
    icon: FolderKanban,
    path: '/projects',
    permission: 'projects.view',
  }, 
  {
    label: 'Tasks',
    icon: CheckSquare,
    path: '/tasks',
    permission: 'tasks.view',
  },
  {
    label: 'Mails',
    icon: Mail,
    path: '/mails',
    permission: 'mails.view',
  },
  {
    label: 'Calendar',
    icon: Calendar,
    path: '/calendar',
    permission: 'calendar.view',
  },
  {
    label: 'Users',
    icon: Users,
    path: '/users',
    permission: 'users.view',
  },
  {
    label: 'Roles',
    icon: Shield,
    path: '/roles',
    permission: 'roles.view',
  },
  {
    label: 'Reports',
    icon: BarChart3,
    path: '/reports',
    permission: 'reports.view',
  },
  {
    label: 'Activity Logs',
    icon: Activity,
    path: '/activity',
    permission: 'activity.view',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  isMobileOpen,
  isMobile,
  onToggleCollapse,
  onCloseMobile,
}) => {
  const location = useLocation();
  const { hasPermission, user } = useAuth();
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  const toggleExpanded = (path: string) => {
    setExpandedItems(prev =>
      prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleNavClick = () => {
    if (isMobile) {
      onCloseMobile();
    }
  };

  const renderNavItem = (item: NavItem, depth = 0) => {
    // Check permission - if no permission required or user has permission
    const canView = !item.permission || hasPermission(item.permission);
    if (!canView) return null;

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.path);
    const active = isActive(item.path);
    const Icon = item.icon;

    // Collapsed state - show only icons with tooltips
    if (isCollapsed && !isMobile) {
      if (hasChildren) {
        return (
          <div key={item.path} className="flex justify-center my-1">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggleExpanded(item.path)}
                    className={cn(
                      'flex h-10 w-10 min-h-[40px] items-center justify-center rounded-lg transition-colors',
                      'hover:bg-sidebar-muted text-sidebar-foreground/80 hover:text-sidebar-foreground',
                      active && 'bg-sidebar-muted text-sidebar-foreground'
                    )}
                    aria-label={item.label}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12} className="z-[9999]">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      }

      return (
        <div key={item.path} className="flex justify-center my-1">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.path}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 w-10 min-h-[40px] items-center justify-center rounded-lg transition-colors',
                      'hover:bg-sidebar-muted text-sidebar-foreground/80 hover:text-sidebar-foreground',
                      isActive && 'bg-sidebar-primary text-sidebar-primary-foreground'
                    )
                  }
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="z-[9999]">
                {item.label}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    }

    // Expanded state
    if (hasChildren) {
      const visibleChildren = item.children?.filter(child => {
        // Hide "My Tasks" for super admin
        if (child.label === 'My Tasks' && user?.role?.name === 'Super Admin') {
          return false;
        }
        return !child.permission || hasPermission(child.permission);
      }) || [];
      return (
        <div key={item.path}>
          <button
            onClick={() => toggleExpanded(item.path)}
            className={cn(
              'nav-item w-full justify-between',
              active && 'bg-sidebar-muted'
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                isExpanded && 'rotate-180'
              )}
            />
          </button>
          {isExpanded && visibleChildren.length > 0 && (
            <div className="ml-4 mt-1 space-y-1">
              {visibleChildren.map(child => renderNavItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={handleNavClick}
        className={({ isActive }) =>
          cn(
            'nav-item',
            isActive && 'nav-item-active'
          )
        }
      >
        <Icon className="h-5 w-5" />
        <span className="font-medium">{item.label}</span>
      </NavLink>
    );
  };

  // Calculate sidebar width
  const sidebarWidth = isCollapsed && !isMobile ? 'w-16' : 'w-64';

  // Mobile: slide-in overlay
  // Desktop/Tablet: fixed sidebar with collapse
  const sidebarClasses = cn(
    'fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out flex flex-col',
    sidebarWidth,
    // Mobile behavior
    isMobile && !isMobileOpen && '-translate-x-full',
    isMobile && isMobileOpen && 'translate-x-0',
    // Desktop behavior
    !isMobile && 'translate-x-0'
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isMobileOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={sidebarClasses} role="navigation" aria-label="Main navigation">
        {/* Logo/Header */}
        <div className={cn(
          'flex h-16 items-center border-b border-sidebar-border',
          isCollapsed && !isMobile ? 'justify-center px-2' : 'justify-between px-4'
        )}>
          {isCollapsed && !isMobile ? (
            <img 
              src="/images-removebg-preview.jfif"
              alt="Hakam TechSol"
              className="h-8 w-8 flex-shrink-0"
            />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <img 
                  src="/images-removebg-preview.jfif"
                  alt="Hakam TechSol"
                  className="h-12 w-12 flex-shrink-0"
                />
                <div>
                  <h1 className="text-base font-semibold text-sidebar-foreground">Hakam TechSol</h1>
                  <p className="text-xs text-sidebar-foreground/60">Management Portal</p>
                </div>
              </div>
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCloseMobile}
                  className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-muted"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin py-4',
          isCollapsed && !isMobile ? 'px-2 space-y-2 flex flex-col items-center' : 'px-4 space-y-1'
        )}>
          {navigation.map(item => renderNavItem(item))}
        </nav>

        {/* Footer - Settings & Collapse Button */}
        <div className={cn(
          'border-t border-sidebar-border',
          isCollapsed && !isMobile ? 'p-2 flex flex-col items-center' : 'p-4'
        )}>
          {/* Settings Link */}
          {isCollapsed && !isMobile ? (
            <div className="flex justify-center mb-3">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavLink
                      to="/settings"
                      onClick={handleNavClick}
                      className={({ isActive }) =>
                        cn(
                          'flex h-10 w-10 min-h-[40px] items-center justify-center rounded-lg transition-colors',
                          'hover:bg-sidebar-muted text-sidebar-foreground/80 hover:text-sidebar-foreground',
                          isActive && 'bg-sidebar-primary text-sidebar-primary-foreground'
                        )
                      }
                      aria-label="Settings"
                    >
                      <Settings className="h-5 w-5 flex-shrink-0" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12} className="z-[9999]">Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <NavLink
              to="/settings"
              onClick={handleNavClick}
              className={({ isActive }) =>
                cn('nav-item mb-2', isActive && 'nav-item-active')
              }
            >
              <Settings className="h-5 w-5" />
              <span className="font-medium">Settings</span>
            </NavLink>
          )}

          {/* Collapse Toggle Button - Desktop Only */}
          {!isMobile && (
            <div className={cn(isCollapsed && 'flex justify-center')}>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size={isCollapsed ? 'icon' : 'sm'}
                      onClick={onToggleCollapse}
                      className={cn(
                        'transition-colors text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-muted',
                        isCollapsed ? 'h-10 w-10 min-h-[40px]' : 'w-full justify-start gap-2'
                      )}
                      aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-5 w-5 flex-shrink-0" />
                      ) : (
                        <>
                          <ChevronLeft className="h-5 w-5" />
                          <span className="text-sm">Collapse</span>
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right" sideOffset={12} className="z-[9999]">Expand sidebar</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
