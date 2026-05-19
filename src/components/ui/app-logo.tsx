import React from 'react';

interface AppLogoProps {
  className?: string;
  collapsed?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = '', collapsed = false }) => {
  if (collapsed) {
    return (
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl ${className}`}>
        P
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl shrink-0">
        P
      </div>
      <div>
        <h1 className="text-base font-semibold text-sidebar-foreground">Project Portal</h1>
        <p className="text-xs text-sidebar-foreground/60">Shared Workspace</p>
      </div>
    </div>
  );
};

export default AppLogo;
