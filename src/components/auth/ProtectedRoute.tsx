import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
}) => {
  const { isAuthenticated, isLoading, hasPermission, hasAnyPermission, user } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth (WAIT for user to fully load)
  if (isLoading || (isAuthenticated && !user)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Wait until user permissions are loaded (Super Admin has all permissions)
  if (isAuthenticated && user) {
    const roleName = user.role?.name?.toLowerCase().replace(/_/g, ' ') || '';
    const isSuperAdmin = roleName === 'super admin' || roleName === 'superadmin';
    
    // If not super admin, ensure permissions are loaded
    if (!isSuperAdmin && (!user.permissions || user.permissions.length === 0)) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }
  }

  // Check single permission
  if (permission) {
    // allow exact permission or a '.view.all' fallback for view permissions
    const hasExact = hasPermission(permission);
    let hasFallback = false;
    if (!hasExact && permission.endsWith('.view')) {
      const fallback = `${permission}.all`;
      hasFallback = hasPermission(fallback);
    }
    if (!hasExact && !hasFallback) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Check multiple permissions
  if (permissions && permissions.length > 0) {
    if (requireAll) {
      // User must have ALL permissions
      const hasAll = permissions.every(p => hasPermission(p) || (p.endsWith('.view') && hasPermission(`${p}.all`)));
      if (!hasAll) {
        return <Navigate to="/unauthorized" replace />;
      }
    } else {
      // User must have ANY permission
      if (!permissions.some(p => hasPermission(p) || (p.endsWith('.view') && hasPermission(`${p}.all`)))) {
        return <Navigate to="/unauthorized" replace />;
      }
    }
  }

  return <>{children}</>;
};
