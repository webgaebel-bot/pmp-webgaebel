import React, { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { initSocket, onNotificationUpdate } from '@/services/socket';
import type { Notification } from '@/types';

const Notifications: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response: any = await api.getNotifications();
      const notificationsData = response.data || [];
      
      // Map API response to component format and filter out COMMENT_ADDED
      const mappedNotifications = notificationsData
        .filter((notif: any) => notif.type !== 'COMMENT_ADDED')
        .map((notif: any) => ({
          id: String(notif.id),
          title: notif.title || notif.type,
          message: notif.message || notif.description || '',
          
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
      setIsLoading(false);
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
      // Mark all unread notifications as read
      const unreadNotifications = notifications.filter((n) => !n.read);
      await Promise.all(
        unreadNotifications.map((n) => api.markNotificationAsRead(n.id))
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      // Delete all notifications
      await Promise.all(notifications.map((n) => api.deleteNotification(n.id)));
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const getTypeIcon = (type: Notification['type']) => {
    if (typeof type !== 'string') {
      return <Info className="h-5 w-5 text-blue-500" />;
    }
    
    const typeStr = type.toLowerCase();
    if (typeStr.includes('success') || typeStr.includes('completed') || typeStr.includes('added')) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (typeStr.includes('warning') || typeStr.includes('updated')) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
    if (typeStr.includes('error') || typeStr.includes('failed')) {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    return <Info className="h-5 w-5 text-blue-500" />;
  };

  const getTypeBadgeVariant = (type: Notification['type']) => {
    if (typeof type !== 'string') return 'outline';
    
    const typeStr = type.toLowerCase();
    if (typeStr.includes('success') || typeStr.includes('completed') || typeStr.includes('added')) {
      return 'default';
    }
    if (typeStr.includes('warning') || typeStr.includes('updated')) {
      return 'secondary';
    }
    if (typeStr.includes('error') || typeStr.includes('failed')) {
      return 'destructive';
    }
    return 'outline';
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return format(date, 'MMM dd, yyyy');
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread' && n.read) return false;
    if (filter === 'read' && !n.read) return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (isLoading) {
    return <LoadingPage text="Loading notifications..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay updated with your project activities"
        actions={
          unreadCount > 0 ? (
            <Button onClick={handleMarkAllAsRead} className="bg-accent hover:bg-accent/90">
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        {notifications.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={handleClearAll}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          Total: <strong className="text-foreground">{notifications.length}</strong>
        </span>
        <span>
          Unread: <strong className="text-foreground">{unreadCount}</strong>
        </span>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description={
            filter === 'all'
              ? "You're all caught up! No notifications at the moment."
              : `No ${filter} notifications found.`
          }
        />
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-card divide-y divide-border">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                'flex items-start gap-4 p-4 transition-colors hover:bg-muted/50',
                !notification.read && 'bg-accent/5'
              )}
            >
             

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4
                    className={cn(
                      'font-medium text-sm',
                      !notification.read && 'font-semibold'
                    )}
                  >
                    {notification.title}
                  </h4>
                  {!notification.read && (
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {notification.message}
                </p>
                {notification.name && (
                  <p className="text-sm font-medium mb-2">
                    <span className="text-foreground">{notification.name}</span>
                    {notification.email && (
                      <span className="text-muted-foreground ml-1">({notification.email})</span>
                    )}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(notification.created_at)}
                  </span>
                  {/* <Badge variant={getTypeBadgeVariant(notification.type)} className="text-xs">
                    {notification.type}
                  </Badge> */}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleMarkAsRead(notification.id)}
                    title="Mark as read"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(notification.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
