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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  permission?: string;
  children?: NavItem[];
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
    children: [
      { label: 'All Tasks', icon: CheckSquare, path: '/tasks', permission: 'tasks.view' },
      { label: 'My Tasks', icon: CheckSquare, path: '/tasks/my', permission: 'tasks.view' },
    ],
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

export const Sidebar: React.FC = () => {
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

  const renderNavItem = (item: NavItem, depth = 0) => {
    // Check permission - if no permission required or user has permission
    const canView = !item.permission || hasPermission(item.permission);
    if (!canView) return null;

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.path);
    const active = isActive(item.path);

    if (hasChildren) {
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
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                isExpanded && 'rotate-180'
              )}
            />
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.children?.map(child => renderNavItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        className={({ isActive }) =>
          cn(
            'nav-item',
            isActive && 'nav-item-active'
          )
        }
      >
        <item.icon className="h-5 w-5" />
        <span className="font-medium">{item.label}</span>
      </NavLink>
    );
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <FileText className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-sidebar-foreground">ProjectHub</h1>
          <p className="text-xs text-sidebar-foreground/60">Management Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4 scrollbar-thin">
        {navigation.map(item => renderNavItem(item))}
      </nav>

      {/* User Section */}
      <div className="border-t border-sidebar-border p-4">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn('nav-item', isActive && 'nav-item-active')
          }
        >
          <Settings className="h-5 w-5" />
          <span className="font-medium">Settings</span>
        </NavLink>
      </div>
    </aside>
  );
};
