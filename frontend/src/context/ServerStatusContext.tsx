import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

interface ServerStatusContextType {
  isAwake: boolean;
  isChecking: boolean;
  dbStatus: string;
  checkHealth: () => Promise<boolean>;
}

const ServerStatusContext = createContext<ServerStatusContextType | undefined>(undefined);

export const ServerStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAwake, setIsAwake] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<string>('checking');

  const checkHealth = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const res = await api.checkHealth();
      setIsAwake(res.status === 'ok');
      setDbStatus(res.database || 'connected');
      setIsChecking(false);
      return true;
    } catch {
      setIsAwake(false);
      setDbStatus('sleeping');
      setIsChecking(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const performCheck = async () => {
      const ok = await checkHealth();
      if (!ok) {
        // Si falló (backend en frío en Render), reintentar cada 5 segundos hasta que despierte
        interval = setInterval(async () => {
          const recheck = await checkHealth();
          if (recheck && interval) {
            clearInterval(interval);
          }
        }, 5000);
      }
    };

    performCheck();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [checkHealth]);

  return (
    <ServerStatusContext.Provider value={{ isAwake, isChecking, dbStatus, checkHealth }}>
      {children}
    </ServerStatusContext.Provider>
  );
};

export const useServerStatus = (): ServerStatusContextType => {
  const context = useContext(ServerStatusContext);
  if (!context) {
    throw new Error('useServerStatus debe ser utilizado dentro de un ServerStatusProvider');
  }
  return context;
};
