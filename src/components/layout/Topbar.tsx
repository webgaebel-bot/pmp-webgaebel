import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Menu,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IMAGE_BASE_URL } from '@/services/api';
import { cn } from '@/lib/utils';

interface TopbarProps {
  isMobile: boolean;
  isCollapsed: boolean;
  onToggleMobile: () => void;
  onToggleCollapse: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  isMobile,
  isCollapsed,
  onToggleMobile,
  onToggleCollapse,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      {/* Left Section */}
      <div className="flex items-center gap-2">
        {/* Mobile Menu Toggle */}
        {isMobile && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleMobile}
                  className="shrink-0"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open menu</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Desktop Collapse Toggle */}
        {!isMobile && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleCollapse}
                  className="shrink-0"
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {isCollapsed ? (
                    <PanelLeft className="h-5 w-5" />
                  ) : (
                    <PanelLeftClose className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search projects, tasks..."
            className="w-64 lg:w-80 pl-10 bg-secondary/50 border-0 focus-visible:ring-accent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-accent text-accent-foreground text-xs">
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold">Notifications</span>
              <Button variant="ghost" size="sm" className="text-xs text-accent">
                Mark all as read
              </Button>
            </div>
            <div className="py-2">
              <DropdownMenuItem className="flex flex-col items-start gap-1 px-4 py-3 cursor-pointer">
                <span className="font-medium text-sm">New task assigned</span>
                <span className="text-xs text-muted-foreground">
                  You have been assigned to "Update dashboard UI"
                </span>
                <span className="text-xs text-muted-foreground">2 min ago</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 px-4 py-3 cursor-pointer">
                <span className="font-medium text-sm">Project deadline approaching</span>
                <span className="text-xs text-muted-foreground">
                  "Website Redesign" is due in 2 days
                </span>
                <span className="text-xs text-muted-foreground">1 hour ago</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 px-4 py-3 cursor-pointer">
                <span className="font-medium text-sm">Comment on your task</span>
                <span className="text-xs text-muted-foreground">
                  John commented on "API Integration"
                </span>
                <span className="text-xs text-muted-foreground">3 hours ago</span>
              </DropdownMenuItem>
            </div>
            <div className="border-t px-4 py-2">
              <Button variant="ghost" size="sm" className="w-full text-accent">
                View all notifications
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 md:gap-3 px-2 hover:bg-secondary"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user?.avatar ? `${IMAGE_BASE_URL}${user.avatar}` : undefined}
                  alt={user?.name}
                />
                <AvatarFallback className="bg-accent text-accent-foreground text-sm">
                  {user?.name ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:block text-left">
                <p className="text-sm font-medium">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.role?.name || 'Member'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden lg:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-4 py-3 border-b">
              <p className="font-medium">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuItem onClick={() => navigate('/settings/profile')} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
