import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthState } from '@/types';
import api from '@/services/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
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

// Helper function to store user in localStorage
const storeUser = (user: User | null) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
      permissions: user.permissions || [],
      avatar: user.avatar,
      status: user.status,
    }));
  } else {
    localStorage.removeItem('user');
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: getStoredUser(),
    token: localStorage.getItem('auth_token'),
    isAuthenticated: !!localStorage.getItem('auth_token') && !!getStoredUser(),
    isLoading: true,
  });

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      const storedUser = getStoredUser();
      
      if (token && storedUser) {
        try {
          const response: any = await api.getCurrentUser();
          const user = response.data || response;
          
          // Store user in localStorage with proper structure
          storeUser(user);
          
          setState({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          // If API fails but we have stored user with role info, use it
          if (storedUser && storedUser.role) {
            setState({
              user: storedUser,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            setState({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        }
      } else {
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response: any = await api.login(email, password);
    const { token, user } = response.data || response;
    
    // Store token
    localStorage.setItem('auth_token', token);
    
    // Store user in localStorage with proper structure
    storeUser(user);
    
    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      // Continue with local logout even if API fails
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
    if (!state.user) return false;
    // Super admin has all permissions
    const roleName = state.user.role?.name?.toLowerCase().replace(/_/g, ' ') || '';
    if (roleName === 'super admin' || roleName === 'superadmin') {
      return true;
    }
    // Check from state user permissions
    return state.user.permissions?.includes(permission) || false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!state.user) return false;
    // Super admin has all permissions
    const roleName = state.user.role?.name?.toLowerCase().replace(/_/g, ' ') || '';
    if (roleName === 'super admin' || roleName === 'superadmin') {
      return true;
    }
    return permissions.some(p => state.user?.permissions?.includes(p));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission, hasAnyPermission }}>
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
  const user = getStoredUser();
  if (!user) return false;
  return user.permissions?.includes(permission) || false;
};
