'use client';

import * as React from 'react';

/**
 * SISTEMA CENTRAL DE TEMA SAVYRON — dark (padrão) ↔ light.
 *
 * - Aplica `data-theme="dark|light"` no elemento raiz (<html>).
 * - Persiste em localStorage (chave `savyron-theme`).
 * - Padrão OBRIGATÓRIO: dark — usuários existentes não mudam de experiência.
 * - Sem flash: layout.tsx aplica o atributo antes da hidratação (script inline).
 * - Exclusivamente visual: nenhum dado, API ou comportamento é afetado.
 */

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'savyron-theme';

export function isValidTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

/** Lê a preferência armazenada (null = sem preferência → dark). */
export function getStoredTheme(storage: Pick<Storage, 'getItem'> | null): Theme {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY) ?? null;
    return isValidTheme(raw) ? raw : 'dark';
  } catch {
    return 'dark';
  }
}

/** Persiste a preferência. */
export function storeTheme(storage: Pick<Storage, 'setItem'> | null, theme: Theme): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* noop (privacy mode etc.) */
  }
}

/** Aplica o tema no elemento raiz. */
export function applyTheme(root: Pick<HTMLElement, 'setAttribute' | 'removeAttribute'> | null, theme: Theme): void {
  if (!root) return;
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    // dark é o default — atributo ausente mantém o tema atual intacto.
    root.removeAttribute('data-theme');
  }
}

/** Lê o tema já aplicado no DOM (pelo script anti-flash). */
function readAppliedTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => readAppliedTheme());

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(document.documentElement, next);
    storeTheme(window.localStorage, next);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      applyTheme(document.documentElement, next);
      storeTheme(window.localStorage, next);
      return next;
    });
  }, []);

  // Sincroniza entre abas (mesma preferência em todo o painel).
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && isValidTheme(e.newValue)) {
        setThemeState(e.newValue);
        applyTheme(document.documentElement, e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = React.useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    // Fallback seguro: nunca quebra consumidores fora do provider (testes, V1).
    return {
      theme: readAppliedTheme(),
      setTheme: (next) => {
        applyTheme(document.documentElement, next);
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch { /* noop */ }
      },
      toggleTheme: () => {
        const next = readAppliedTheme() === 'light' ? 'dark' : 'light';
        applyTheme(document.documentElement, next);
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch { /* noop */ }
      },
    };
  }
  return ctx;
}

/**
 * Script anti-flash: aplica o tema ANTES da hidratação/primeira pintura.
 * Sem preferência salva → dark (default obrigatório).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}else{document.documentElement.removeAttribute('data-theme');}}catch(e){}})();`;
