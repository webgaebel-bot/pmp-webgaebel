import React from 'react';
import { cn } from '@/lib/utils';

interface LeadScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

export function LeadScoreBadge({ score, size = 'md' }: LeadScoreBadgeProps) {
  const normalizedScore = Math.max(0, Math.min(100, Number(score) || 0));
  const radius = size === 'sm' ? 18 : 24;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (normalizedScore / 100) * circumference;

  const tone =
    normalizedScore >= 75 ? 'text-emerald-600' : normalizedScore >= 50 ? 'text-amber-500' : 'text-rose-500';

  const dimensions = size === 'sm' ? 44 : 56;

  return (
    <div className={cn('relative inline-flex items-center justify-center', tone)} style={{ width: dimensions, height: dimensions }}>
      <svg width={dimensions} height={dimensions} className="-rotate-90">
        <circle cx={dimensions / 2} cy={dimensions / 2} r={radius} stroke="currentColor" strokeOpacity="0.18" strokeWidth={strokeWidth} fill="transparent" />
        <circle
          cx={dimensions / 2}
          cy={dimensions / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="absolute text-[11px] font-semibold text-foreground">{normalizedScore}</span>
    </div>
  );
}
