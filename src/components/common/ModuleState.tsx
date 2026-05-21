import React from 'react';
import { AlertTriangle, FileQuestion, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ModuleStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const ModuleLoadingState: React.FC<ModuleStateProps> = ({
  title,
  description,
  className,
}) => (
  <Card className={cn('border-dashed bg-muted/20', className)}>
    <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </CardContent>
  </Card>
);

export const ModuleEmptyState: React.FC<ModuleStateProps & { icon?: React.ElementType }> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = FileQuestion,
  className,
}) => (
  <Card className={cn('border-dashed bg-muted/10', className)}>
    <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <Button variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </CardContent>
  </Card>
);

export const ModuleErrorState: React.FC<ModuleStateProps & { error?: string }> = ({
  title,
  description,
  error,
  actionLabel = 'Retry',
  onAction,
  className,
}) => (
  <Card className={cn('border-destructive/20 bg-destructive/5', className)}>
    <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-destructive/20">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description || error || 'Something went wrong.'}</p>
      </div>
      {onAction ? (
        <Button variant="destructive" onClick={onAction}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {actionLabel}
        </Button>
      ) : null}
    </CardContent>
  </Card>
);
