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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import api, { IMAGE_BASE_URL } from '@/services/api';
import type { ActivityLog } from '@/types';

// Mock data
const mockActivityLogs: ActivityLog[] = [
  {
    id: '1',
    user: { id: '1', name: 'Sarah Johnson', email: 'sarah@example.com' } as any,
    action: 'created',
    entity_type: 'project',
    entity_id: '1',
    entity_name: 'E-commerce Platform',
    created_at: '2024-03-15T14:30:00',
  },
  {
    id: '2',
    user: { id: '2', name: 'Mike Chen', email: 'mike@example.com' } as any,
    action: 'updated',
    entity_type: 'task',
    entity_id: '5',
    entity_name: 'Implement login',
    details: 'Status changed from "in_progress" to "done"',
    created_at: '2024-03-15T13:45:00',
  },
  {
    id: '3',
    user: { id: '3', name: 'Emily Davis', email: 'emily@example.com' } as any,
    action: 'commented',
    entity_type: 'task',
    entity_id: '8',
    entity_name: 'Design review',
    created_at: '2024-03-15T12:20:00',
  },
  {
    id: '4',
    user: { id: '1', name: 'Sarah Johnson', email: 'sarah@example.com' } as any,
    action: 'assigned',
    entity_type: 'task',
    entity_id: '12',
    entity_name: 'API integration',
    details: 'Assigned to Mike Chen',
    created_at: '2024-03-15T11:10:00',
  },
  {
    id: '5',
    user: { id: '4', name: 'James Wilson', email: 'james@example.com' } as any,
    action: 'deleted',
    entity_type: 'file',
    entity_id: '3',
    entity_name: 'old_design.pdf',
    created_at: '2024-03-15T10:05:00',
  },
  {
    id: '6',
    user: { id: '2', name: 'Mike Chen', email: 'mike@example.com' } as any,
    action: 'created',
    entity_type: 'user',
    entity_id: '10',
    entity_name: 'New team member',
    created_at: '2024-03-14T16:30:00',
  },
  {
    id: '7',
    user: { id: '1', name: 'Sarah Johnson', email: 'sarah@example.com' } as any,
    action: 'updated',
    entity_type: 'role',
    entity_id: '2',
    entity_name: 'Project Manager',
    details: 'Added new permissions',
    created_at: '2024-03-14T15:45:00',
  },
];

const entityIcons: Record<string, React.ElementType> = {
  project: FolderKanban,
  task: CheckSquare,
  user: User,
  role: Shield,
  file: Settings,
};

const actionColors: Record<string, string> = {
  created: 'bg-success/10 text-success',
  updated: 'bg-info/10 text-info',
  deleted: 'bg-destructive/10 text-destructive',
  commented: 'bg-warning/10 text-warning',
  assigned: 'bg-accent/10 text-accent',
};

const Activity: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const response: any = activeTab === 'my'
          ? await api.getMyActivityLogs()
          : await api.getActivityLogs();
        setLogs(response.data || mockActivityLogs);
      } catch (error) {
        setLogs(mockActivityLogs);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [activeTab]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.entity_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    return matchesSearch && matchesEntity;
  });

  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const date = format(new Date(log.created_at), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(log);
    return acc;
  }, {} as Record<string, ActivityLog[]>);

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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Activity</TabsTrigger>
          <TabsTrigger value="my">My Activity</TabsTrigger>
        </TabsList>
      </Tabs>

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
        <div className="space-y-8">
          {Object.entries(groupedLogs).map(([date, dayLogs]) => (
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
                        <AvatarFallback className="bg-accent/20 text-accent">
                          {log.user?.name?.split(' ').map(n => n[0]).join('') || '?'}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="font-medium">{log.user?.name}</span>
                          <Badge className={`${actionColors[log.action]} border-0`}>
                            {log.action}
                          </Badge>
                          <span className="text-muted-foreground">a</span>
                          <Badge variant="secondary" className="font-normal">
                            <Icon className="mr-1 h-3 w-3" />
                            {log.entity_type}
                          </Badge>
                        </div>

                        <p className="mt-1 text-sm">
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
      )}
    </div>
  );
};

export default Activity;
