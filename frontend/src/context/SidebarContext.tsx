import React, { createContext, useContext, useState, useEffect } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setIsCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dealhunter_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  const toggleSidebar = () => {
    setIsCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dealhunter_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const setIsCollapsed = (collapsed: boolean) => {
    setIsCollapsedState(collapsed);
    try {
      localStorage.setItem('dealhunter_sidebar_collapsed', String(collapsed));
    } catch {}
  };

  const toggleMobile = () => {
    setMobileOpen((prev) => !prev);
  };

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleSidebar,
        setIsCollapsed,
        mobileOpen,
        setMobileOpen,
        toggleMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = (): SidebarContextType => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar debe ser utilizado dentro de un SidebarProvider');
  }
  return context;
};
