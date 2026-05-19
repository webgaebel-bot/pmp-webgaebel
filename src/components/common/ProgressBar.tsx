import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showLabel = false,
  size = 'md',
  className,
}) => {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? value : 0;
  const percentage = Math.min(Math.max((safeValue / safeMax) * 100, 0), 100);

  const getColorClass = () => {
    if (percentage >= 100) return 'bg-success';
    if (percentage >= 70) return 'bg-accent';
    if (percentage >= 40) return 'bg-info';
    return 'bg-warning';
  };

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <div className={cn('min-w-0 flex-1 rounded-full bg-muted overflow-hidden', sizeStyles[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', getColorClass())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-muted-foreground min-w-[3rem] text-right">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
};
