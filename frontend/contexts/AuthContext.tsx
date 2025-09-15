// Authentication Context for Codebase Index Frontend
// This context provides authentication state and functions to React components

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '@services/auth.service';
import { ApiResponse } from '@types/api.types';

// Define the shape of our authentication context
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<ApiResponse<any>>;
  logout: () => Promise<ApiResponse<any>>;
  hasRole: (role: 'admin' | 'user' | 'viewer') => boolean;
  isLoading: boolean;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: async () => ({ success: false, timestamp: new Date().toISOString() }),
  logout: async () => ({ success: false, timestamp: new Date().toISOString() }),
  hasRole: () => false,
  isLoading: true,
});

// Props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

// AuthProvider component that wraps the application and provides auth context
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check authentication status on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = () => {
    try {
      const currentUser = authService.getCurrentUser();
      const authStatus = authService.isAuthenticated();
      
      setUser(currentUser);
      setIsAuthenticated(authStatus);
    } catch (error) {
      // If there's an error, clear auth state
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await authService.login(username, password);
    
    if (response.success && response.data) {
      setUser(response.data.user);
      setIsAuthenticated(true);
    }
    
    return response;
  };

  const logout = async () => {
    const response = await authService.logout();
    
    if (response.success) {
      setUser(null);
      setIsAuthenticated(false);
    }
    
    return response;
  };

  const hasRole = (role: 'admin' | 'user' | 'viewer'): boolean => {
    return authService.hasRole(role);
  };

  const contextValue: AuthContextType = {
    user,
    isAuthenticated,
    login,
    logout,
    hasRole,
    isLoading,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the authentication context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

// Export the context for direct access if needed
export default AuthContext;