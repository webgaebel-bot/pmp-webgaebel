import { useState, useEffect, useCallback } from 'react';

const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed';
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  isMobile: boolean;
  isTablet: boolean;
  toggleCollapsed: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
}

export const useSidebar = (): SidebarState => {
  // Get initial collapsed state from localStorage or default based on screen size
  const getInitialCollapsed = (): boolean => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) return stored === 'true';
    return window.innerWidth < TABLET_BREAKPOINT;
  };

  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );
  const [isTablet, setIsTablet] = useState(
    typeof window !== 'undefined' 
      ? window.innerWidth >= MOBILE_BREAKPOINT && window.innerWidth < TABLET_BREAKPOINT 
      : false
  );

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const newIsMobile = width < MOBILE_BREAKPOINT;
      const newIsTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
      
      setIsMobile(newIsMobile);
      setIsTablet(newIsTablet);
      
      // Close mobile sidebar when resizing to desktop
      if (!newIsMobile) {
        setIsMobileOpen(false);
      }
      
      // Auto-collapse on tablet if not manually set
      if (newIsTablet && localStorage.getItem(SIDEBAR_STORAGE_KEY) === null) {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persist collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const toggleMobile = useCallback(() => {
    setIsMobileOpen(prev => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  return {
    isCollapsed,
    isMobileOpen,
    isMobile,
    isTablet,
    toggleCollapsed,
    toggleMobile,
    closeMobile,
  };
};
