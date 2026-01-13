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
  const { isAuthenticated, isLoading, hasPermission, hasAnyPermission } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
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
