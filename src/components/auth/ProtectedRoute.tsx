import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userHasAllPermissions, userHasAnyPermission } from '@/lib/permissions';

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
  const { isAuthenticated, isLoading, hasPermission, user } = useAuth();
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

  // Check single permission
  if (permission) {
    if (!hasPermission(permission)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Check multiple permissions
  if (permissions && permissions.length > 0) {
    if (requireAll) {
      if (!userHasAllPermissions(user, permissions)) {
        return <Navigate to="/unauthorized" replace />;
      }
    } else {
      if (!userHasAnyPermission(user, permissions)) {
        return <Navigate to="/unauthorized" replace />;
      }
    }
  }

  return <>{children}</>;
};
