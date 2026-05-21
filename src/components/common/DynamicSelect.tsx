import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface DynamicOption {
  value: string;
  label: string;
  meta?: string;
}

interface DynamicSelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: DynamicOption[];
  placeholder?: string;
  emptyLabel?: string;
  allowCustom?: boolean;
  customValue?: string;
  onCustomValueChange?: (value: string) => void;
  onAddCustom?: (value: string) => void;
  customLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  helperText?: string;
  className?: string;
}

export const DynamicSelect: React.FC<DynamicSelectProps> = ({
  label,
  value,
  onValueChange,
  options,
  placeholder = 'Select an option',
  emptyLabel = 'No options available',
  allowCustom = false,
  customValue = '',
  onCustomValueChange,
  onAddCustom,
  customLabel = 'Add option',
  loading = false,
  disabled = false,
  helperText,
  className,
}) => {
  const normalizedValue = value || '';
  const showCustom = allowCustom && normalizedValue === '__custom__';

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <Select value={normalizedValue} onValueChange={onValueChange} disabled={disabled || loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? 'Loading...' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {loading ? (
            <SelectItem value="__loading__" disabled>
              Loading...
            </SelectItem>
          ) : options.length > 0 ? (
            options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span>{option.label}</span>
                  {option.meta ? <span className="text-xs text-muted-foreground">{option.meta}</span> : null}
                </div>
              </SelectItem>
            ))
          ) : (
            <SelectItem value="__empty__" disabled>
              {emptyLabel}
            </SelectItem>
          )}
          {allowCustom ? <SelectItem value="__custom__">{customLabel}</SelectItem> : null}
        </SelectContent>
      </Select>
      {showCustom ? (
        <div className="flex gap-2">
          <Input
            value={customValue}
            onChange={(event) => onCustomValueChange?.(event.target.value)}
            placeholder="Type a custom value"
          />
          {onAddCustom ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onAddCustom(customValue)}
              disabled={!customValue.trim()}
            >
              Add
            </Button>
          ) : null}
        </div>
      ) : null}
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
};
