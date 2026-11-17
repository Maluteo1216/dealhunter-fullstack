import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, removeToken, setToken } from '../api/client';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(localStorage.getItem('dealhunter_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('dealhunter_token');
      if (storedToken) {
        try {
          const userData = await api.getMe();
          setUser(userData);
        } catch {
          removeToken();
          setTokenState(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
  };

  const register = async (username: string, email: string, password: string) => {
    const res = await api.register(username, email, password);
    setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
  };

  const loginWithGoogle = async (credential: string) => {
    const res = await api.loginWithGoogle(credential);
    setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
  };

  const logout = () => {
    removeToken();
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
