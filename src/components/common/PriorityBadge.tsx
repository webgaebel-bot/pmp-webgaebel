import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowDown, ArrowUp, Flame } from 'lucide-react';

interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'critical';
  showIcon?: boolean;
  className?: string;
}

const priorityConfig = {
  low: {
    label: 'Low',
    icon: ArrowDown,
    className: 'bg-muted text-muted-foreground',
  },
  medium: {
    label: 'Medium',
    icon: ArrowUp,
    className: 'bg-info/10 text-info',
  },
  high: {
    label: 'High',
    icon: AlertTriangle,
    className: 'bg-warning/10 text-warning',
  },
  critical: {
    label: 'Critical',
    icon: Flame,
    className: 'bg-destructive/10 text-destructive',
  },
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  showIcon = true,
  className,
}) => {
  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'priority-badge inline-flex items-center gap-1.5',
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="h-3.5 w-3.5" />}
      {config.label}
    </span>
  );
};
