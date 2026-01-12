import React from 'react';
import { cn } from '@/lib/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'default';

interface StatusBadgeProps {
  status?: string;
  type?: StatusType;
  className?: string;
}

const statusTypeMap: Record<string, StatusType> = {
  // Task statuses
  todo: 'default',
  in_progress: 'info',
  review: 'warning',
  done: 'success',
  blocked: 'error',
  // Project statuses
  planning: 'default',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'error',
  // User statuses
  active: 'success',
  inactive: 'error',
};

const typeStyles: Record<StatusType, string> = {
  success: 'bg-success/10 text-success border border-success/20',
  warning: 'bg-warning/10 text-warning border border-warning/20',
  error: 'bg-destructive/10 text-destructive border border-destructive/20',
  info: 'bg-info/10 text-info border border-info/20',
  default: 'bg-muted text-muted-foreground border border-border',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type,
  className,
}) => {
  // Handle undefined or null status
  if (!status) {
    return (
      <span
        className={cn(
          'status-badge capitalize',
          typeStyles.default,
          className
        )}
      >
        Unknown
      </span>
    );
  }

  const statusType = type || statusTypeMap[status.toLowerCase()] || 'default';
  const displayStatus = status.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'status-badge capitalize',
        typeStyles[statusType],
        className
      )}
    >
      {displayStatus}
    </span>
  );
};
