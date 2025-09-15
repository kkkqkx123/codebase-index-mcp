import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'auto'
}) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Try to get theme from localStorage or use default
    const savedTheme = localStorage.getItem('theme') as Theme;
    return savedTheme || defaultTheme;
  });

  const [isDark, setIsDark] = useState(false);

  // Update the document and state when theme changes
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove existing theme attribute
    root.removeAttribute('data-theme');
    
    let shouldBeDark = false;
    
    if (theme === 'dark') {
      shouldBeDark = true;
      root.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      shouldBeDark = false;
      root.setAttribute('data-theme', 'light');
    } else if (theme === 'auto') {
      // Check system preference
      shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', shouldBeDark ? 'dark' : 'light');
    }
    
    setIsDark(shouldBeDark);
    
    // Save theme to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (theme !== 'auto') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      const shouldBeDark = e.matches;
      
      root.setAttribute('data-theme', shouldBeDark ? 'dark' : 'light');
      setIsDark(shouldBeDark);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme(currentTheme => {
      if (currentTheme === 'light') return 'dark';
      if (currentTheme === 'dark') return 'auto';
      return 'light';
    });
  };

  const value: ThemeContextType = {
    theme,
    setTheme,
    isDark,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};