import React, { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface PermissionGuardProps {
  children: ReactNode;
  permission?: string | string[];
  fallback?: ReactNode;
  requireAll?: boolean;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  fallback = null,
  requireAll = false,
}) => {
  const { hasPermission, hasAnyPermission } = useAuth();

  if (!permission) {
    return <>{children}</>;
  }

  let hasAccess = false;

  if (Array.isArray(permission)) {
    if (requireAll) {
      // User must have ALL permissions
      hasAccess = permission.every(p => hasPermission(p));
    } else {
      // User must have ANY permission
      hasAccess = hasAnyPermission(permission);
    }
  } else {
    // Single permission check
    hasAccess = hasPermission(permission);
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGuard;
