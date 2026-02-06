import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
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
  CheckCheck,
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
import { IMAGE_BASE_URL, api } from '@/services/api';
import { initSocket, onNotificationUpdate } from '@/services/socket';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    // Load profile image from localStorage
    const savedProfileImage = localStorage.getItem('profile_image');
    if (savedProfileImage) {
      setProfileImage(savedProfileImage);
    }
    
    // Also use profile_image from user object if available
    if (user?.profile_image) {
      setProfileImage(user.profile_image);
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoadingNotifications(true);
      const response: any = await api.getNotifications();
      const notificationsData = response.data || [];
      
      // Map API response to component format and filter out COMMENT_ADDED
      const mappedNotifications = notificationsData
        .filter((notif: any) => notif.type !== 'COMMENT_ADDED')
        .map((notif: any) => ({
          id: String(notif.id),
          title: notif.title || notif.type,
          message: notif.message || notif.description || '',
          type: notif.type || 'info',
          read: notif.is_read === 1 ? true : (notif.read || false),
          created_at: notif.created_at || new Date().toISOString(),
          name: notif.name || '',
          email: notif.email || '',
          entity_type: notif.entity_type || '',
          entity_id: notif.entity_id || '',
          user_id: notif.user_id || '',
        }));
      
      setNotifications(mappedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    initSocket();
    const unsub = onNotificationUpdate(() => {
      fetchNotifications();
    });
    return () => {
      unsub();
    };
  }, [fetchNotifications]);

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

  // Get only unread notifications, latest first, limit to 5
  const unreadNotifications = notifications
    .filter((n) => !n.read)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter((n) => !n.read);
      await Promise.all(
        unreadNotifs.map((n) => api.markNotificationAsRead(n.id))
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
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
              {unreadCount > 0 && (
                <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-accent text-accent-foreground text-xs">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold">Notifications</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-accent"
                onClick={handleMarkAllAsRead}
              >
                Mark all as read
              </Button>
            </div>
            <div className="py-2 max-h-64 overflow-y-auto">
              {isLoadingNotifications ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">Loading...</div>
              ) : unreadNotifications.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">No new notifications</div>
              ) : (
                unreadNotifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    onClick={() => handleMarkAsRead(n.id)}
                    className="flex flex-col items-start gap-1.5 px-4 py-3 cursor-pointer"
                  >
                    <div className="flex flex-col gap-1 w-full">
                      <span className="font-medium text-sm">{n.title}</span>
                      <span className="text-xs text-muted-foreground">{n.message}</span>
                      {n.name && (
                        <span className="text-xs text-foreground font-medium">
                          {n.name} {n.email && <span className="text-muted-foreground">({n.email})</span>}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{format(new Date(n.created_at), 'p, MMM d')}</span>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </div>
            <div className="border-t px-4 py-2">
              <Button variant="ghost" size="sm" className="w-full text-accent" onClick={() => navigate('/notifications')}>
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
                  src={profileImage ? `${IMAGE_BASE_URL}${profileImage}` : (user?.avatar ? `${IMAGE_BASE_URL}${user.avatar}` : undefined)}
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
