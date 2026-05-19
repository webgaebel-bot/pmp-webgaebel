import React, { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userHasAllPermissions, userHasAnyPermission, userHasPermission } from '@/lib/permissions';

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
  const { user } = useAuth();

  if (!permission) {
    return <>{children}</>;
  }

  let hasAccess = false;

  if (Array.isArray(permission)) {
    if (requireAll) {
      hasAccess = userHasAllPermissions(user, permission);
    } else {
      hasAccess = userHasAnyPermission(user, permission);
    }
  } else {
    hasAccess = userHasPermission(user, permission);
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGuard;
