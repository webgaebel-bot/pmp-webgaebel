import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Search,
  Filter,
  Activity as ActivityIcon,
  User,
  FolderKanban,
  CheckSquare,
  Shield,
  Settings,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import api, { IMAGE_BASE_URL } from '@/services/api';

const entityIcons: Record<string, React.ElementType> = {
  project: FolderKanban,
  task: CheckSquare,
  user: User,
  role: Shield,
  file: Settings,
  rolepermissions: Shield,
  rolepermission: Shield,
};

const actionColors: Record<string, string> = {
  CREATE: 'bg-success/10 text-success',
  UPDATE: 'bg-info/10 text-info',
  DELETE: 'bg-destructive/10 text-destructive',
  'TASK_COMMENT_ADDED': 'bg-warning/10 text-warning',
  ASSIGN: 'bg-accent/10 text-accent',
};

const Activity: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [displayCount, setDisplayCount] = useState(10);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const response: any = await api.getActivityLogs();
        const logsData = Array.isArray(response) ? response : (response?.data || []);
        
        // Map API response to component format
        const mappedLogs = logsData.map((log: any) => ({
          id: log.id,
          user: {
            name: log.user_name || 'Unknown User',
            email: log.email || '',
            avatar: log.user_avatar,
          },
          action: log.action || 'UNKNOWN',
          entity_type: (log.entity_type || '').toLowerCase(),
          entity_id: log.entity_id,
          entity_name: log.entity_type,
          details: '',
          created_at: log.created_at,
        }));
        
        setLogs(mappedLogs);
      } catch (error) {
        console.error('Error fetching activity logs:', error);
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.entity_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    return matchesSearch && matchesEntity;
  });

  const groupedLogs = filteredLogs
    .slice(0, displayCount)
    .reduce((acc, log) => {
      try {
        const date = format(new Date(log.created_at), 'yyyy-MM-dd');
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(log);
      } catch (e) {
        // Handle invalid dates
      }
      return acc;
    }, {} as Record<string, any[]>);

  if (isLoading) {
    return <LoadingPage text="Loading activity logs..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="Track all activities across the system"
        breadcrumbs={[{ label: 'Activity' }]}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Entity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="project">Projects</SelectItem>
            <SelectItem value="task">Tasks</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="role">Roles</SelectItem>
            <SelectItem value="file">Files</SelectItem>
            <SelectItem value="rolepermissions">Permissions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity Timeline */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity found"
          description="Activity will appear here as users interact with the system."
        />
      ) : (
        <>
          <div className="space-y-8">
            {Object.entries(groupedLogs)
              .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
              .map(([date, dayLogs]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {format(new Date(date), 'EEEE, MMMM dd, yyyy')}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="space-y-4">
                    {dayLogs.map((log) => {
                      const Icon = entityIcons[log.entity_type] || ActivityIcon;
                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-4 bg-card rounded-lg border border-border p-4 shadow-card hover:shadow-soft transition-shadow"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={log.user?.avatar ? `${IMAGE_BASE_URL}${log.user.avatar}` : undefined} />
                            <AvatarFallback className="bg-accent/20 text-accent text-xs">
                              {log.user?.name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="font-medium text-sm">{log.user?.name}</span>
                              <Badge className={`${actionColors[log.action] || 'bg-muted/10 text-muted-foreground'} border-0 text-xs`}>
                                {log.action?.replace(/_/g, ' ')}
                              </Badge>
                              <span className="text-muted-foreground text-xs">on a</span>
                              <Badge variant="secondary" className="font-normal text-xs">
                                <Icon className="mr-1 h-3 w-3" />
                                {log.entity_type}
                              </Badge>
                            </div>

                            <p className="mt-2 text-sm">
                              <span className="font-medium text-foreground">{log.entity_name}</span>
                              {log.details && (
                                <span className="text-muted-foreground"> - {log.details}</span>
                              )}
                            </p>

                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(log.created_at), 'HH:mm')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>

          {/* Load More Button */}
          {displayCount < filteredLogs.length && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => setDisplayCount(prev => prev + 10)}
                className="gap-2"
              >
                <ChevronDown className="h-4 w-4" />
                Load More ({filteredLogs.length - displayCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Activity;
