import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowDown, ArrowUp, Flame, Minus } from 'lucide-react';

interface PriorityBadgeProps {
  priority?: 'low' | 'medium' | 'high' | 'critical' | string;
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

const defaultConfig = {
  label: 'Unknown',
  icon: Minus,
  className: 'bg-muted text-muted-foreground',
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  showIcon = true,
  className,
}) => {
  // Handle undefined or unknown priority values
  const config = priority && priorityConfig[priority as keyof typeof priorityConfig] 
    ? priorityConfig[priority as keyof typeof priorityConfig] 
    : defaultConfig;
  
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
      {priority ? config.label : 'None'}
    </span>
  );
};
