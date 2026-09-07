'use client';

import { useState, useEffect, useCallback } from 'react';

const SIDEBAR_STORAGE_KEY = 'prospector_sidebar_collapsed';

export function useSidebarCollapse(defaultCollapsed = false) {
  const [collapsed, setCollapsedState] = useState<boolean>(defaultCollapsed);

  // Lê preferência salva no localStorage no mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored !== null) {
        setCollapsedState(stored === 'true');
      }
    } catch {
      // localStorage indisponível
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === SIDEBAR_STORAGE_KEY && e.newValue !== null) {
        setCollapsedState(e.newValue === 'true');
      }
    };

    const handleCustom = () => {
      try {
        const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (stored !== null) {
          setCollapsedState(stored === 'true');
        }
      } catch {}
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('sidebar_state_changed', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('sidebar_state_changed', handleCustom);
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
        window.dispatchEvent(new Event('sidebar_state_changed'));
      } catch {}
      return next;
    });
  }, []);

  return { collapsed, setCollapsed: setCollapsedState, toggleCollapsed };
}
