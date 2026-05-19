import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthState } from '@/types';
import api from '@/services/api';
import {
  expandPermissions,
  isSuperAdminRole,
  userHasAnyPermission,
  userHasPermission,
} from '@/lib/permissions';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to get user from localStorage
const getStoredUser = (): User | null => {
  try {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
};

const normalizeUser = (user: any): User | null => {
  if (!user) return null;

  const rawRole = user.role;
  const normalizedRole =
    rawRole && typeof rawRole === 'object'
      ? {
          id: rawRole.id ?? user.role_id ?? '',
          name: rawRole.name ?? user.role_name ?? '',
        }
      : rawRole
        ? {
            id: user.role_id ?? '',
            name: String(rawRole),
          }
        : null;

  return {
    ...user,
    role: normalizedRole,
    permissions: expandPermissions(Array.isArray(user.permissions) ? user.permissions : []),
    profile_image: user.profile_image || user.avatar,
  } as User;
};

// Helper function to store user in localStorage
const storeUser = (user: User | null) => {
  const normalizedUser = normalizeUser(user);

  if (normalizedUser) {
    localStorage.setItem('user', JSON.stringify({
      id: normalizedUser.id,
      name: normalizedUser.name,
      email: normalizedUser.email,
      role: normalizedUser.role ? { id: normalizedUser.role.id, name: normalizedUser.role.name } : null,
      permissions: normalizedUser.permissions || [],
      avatar: normalizedUser.avatar,
      profile_image: normalizedUser.profile_image || normalizedUser.avatar,
      status: normalizedUser.status,
    }));
  } else {
    localStorage.removeItem('user');
    localStorage.removeItem('profile_image');
  }
};

// Helper function to store and retrieve profile image separately
const storeProfileImage = (imageUrl: string | null) => {
  if (imageUrl) {
    localStorage.setItem('profile_image', imageUrl);
  } else {
    localStorage.removeItem('profile_image');
  }
};

const getProfileImage = (): string | null => {
  return localStorage.getItem('profile_image');
};

const isUserActive = (user: User | null): boolean => {
  if (!user || user.status === undefined || user.status === null) return true;
  const status = user.status as any;
  if (typeof status === 'string') return status.toLowerCase() === 'active';
  if (typeof status === 'number') return status === 1;
  if (typeof status === 'boolean') return status === true;
  return true;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: getStoredUser(),
    token: localStorage.getItem('auth_token'),
    isAuthenticated: !!localStorage.getItem('auth_token') && !!getStoredUser(),
    isLoading: true,
  });

  // Track if auth check has completed at least once
  const [authCheckCompleted, setAuthCheckCompleted] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      const storedUser = getStoredUser();
      
      if (!token || !storedUser) {
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
        setAuthCheckCompleted(true);
        return;
      }

      try {
        // Try to fetch current user from API
        const response: any = await api.getCurrentUser();
        const user = normalizeUser(response.data || response);

        if (!isUserActive(user)) {
          console.log('User inactive, clearing session');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          setAuthCheckCompleted(true);
          return;
        }
        
        // Store updated user in localStorage
        storeUser(user);
        
        // Store profile image separately for easy access
        storeProfileImage(user.profile_image || user.avatar);
        
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
        setAuthCheckCompleted(true);
      } catch (error: any) {
        console.error('Auth initialization error:', error);
        
        // Check if it's a network error or server error
        const status = error?.status ?? error?.response?.status ?? 0;
        const isNetworkError = status === 0;
        const isServerError = status >= 500;
        
        // If network error or server error, trust local storage temporarily
        if ((isNetworkError || isServerError) && storedUser && storedUser.role) {
          console.log('Using cached user data due to network/server error');
          setState({
            user: storedUser,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          setAuthCheckCompleted(true);
        } else {
          // Auth token is invalid (401/403) - clear everything
          console.log('Invalid auth token, clearing session');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          setAuthCheckCompleted(true);
        }
      }
    };

    // Only run on initial mount
    if (!authCheckCompleted) {
      initAuth();
    }
  }, [authCheckCompleted]);

  useEffect(() => {
    if (!state.isAuthenticated) return;
    const interval = setInterval(() => {
      refreshAuth();
    }, 60000);
    return () => clearInterval(interval);
  }, [state.isAuthenticated]);

  const refreshAuth = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response: any = await api.getCurrentUser();
      const user = normalizeUser(response.data || response);
      if (!isUserActive(user)) {
        await logout();
        return;
      }
      storeUser(user);
      
      // Store profile image separately for easy access
      storeProfileImage(user.profile_image || user.avatar);
      
      setState(prev => ({
        ...prev,
        user,
        isAuthenticated: true,
      }));
    } catch (error) {
      console.error('Failed to refresh auth:', error);
      // Don't logout on refresh failure, keep using cached data
    }
  };

  const login = async (email: string, password: string) => {
    const response: any = await api.login(email, password);
    const { token, user: loginUser } = response.data || response;
    const user = normalizeUser(loginUser);
    
    if (!isUserActive(user)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      throw new Error('Account is inactive. Please contact admin.');
    }
    
    // Store token first
    localStorage.setItem('auth_token', token);
    
    try {
      // Fetch full user details with permissions from API
      const userResponse: any = await api.getCurrentUser();
      const fullUser = normalizeUser(userResponse.data || userResponse);
      
      // Store complete user data with permissions
      storeUser(fullUser);
      storeProfileImage(fullUser.profile_image || fullUser.avatar);
      
      setState({
        user: fullUser,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      // Fallback: use user from login response
      console.error('Failed to fetch full user after login:', error);
      storeUser(user);
      storeProfileImage(user.profile_image || user.avatar);
      
      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      // Continue with local logout even if API fails
      console.error('Logout API error:', error);
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const hasPermission = (permission: string): boolean => {
    return userHasPermission(state.user, permission);
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    return userHasAnyPermission(state.user, permissions);
  };

  return (
    <AuthContext.Provider value={{ 
      ...state, 
      login, 
      logout, 
      hasPermission, 
      hasAnyPermission,
      refreshAuth 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export helper function for use outside React components
export const hasPermissionHelper = (permission: string): boolean => {
  const user = normalizeUser(getStoredUser());
  if (!user) return false;
  if (isSuperAdminRole(user.role)) return true;
  return userHasPermission(user, permission);
};
