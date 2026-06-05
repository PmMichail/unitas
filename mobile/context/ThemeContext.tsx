import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryMuted: string;
  success: string;
  successMuted: string;
  error: string;
  errorMuted: string;
  warning: string;
  warningMuted: string;
  border: string;
  inputBg: string;
}

export const darkColors: ThemeColors = {
  background: '#0b0f19', // Deep dark blue-slate
  card: 'rgba(23, 29, 43, 0.75)', // Glassmorphic card
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  text: '#f8fafc', // Slate 50
  textMuted: '#94a3b8', // Slate 400
  primary: '#6366f1', // Indigo 500
  primaryMuted: 'rgba(99, 102, 241, 0.15)',
  success: '#10b981', // Emerald 500
  successMuted: 'rgba(16, 185, 129, 0.15)',
  error: '#f43f5e', // Rose 500
  errorMuted: 'rgba(244, 63, 94, 0.15)',
  warning: '#f59e0b', // Amber 500
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  border: 'rgba(255, 255, 255, 0.06)',
  inputBg: 'rgba(17, 24, 39, 0.6)',
};

export const lightColors: ThemeColors = {
  background: '#f8fafc', // Slate 50
  card: '#ffffff',
  cardBorder: '#e2e8f0', // Slate 200
  text: '#0f172a', // Slate 900
  textMuted: '#64748b', // Slate 500
  primary: '#4f46e5', // Indigo 600
  primaryMuted: 'rgba(79, 70, 229, 0.08)',
  success: '#059669', // Emerald 600
  successMuted: 'rgba(5, 150, 105, 0.08)',
  error: '#d91d48', // Rose 600
  errorMuted: 'rgba(217, 29, 72, 0.08)',
  warning: '#d97706', // Amber 600
  warningMuted: 'rgba(217, 119, 6, 0.08)',
  border: '#e2e8f0',
  inputBg: '#f1f5f9',
};

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  setThemeMode: (mode: 'dark' | 'light' | 'system') => void;
  themeMode: 'dark' | 'light' | 'system';
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<'dark' | 'light' | 'system'>('dark'); // Default to dark

  useEffect(() => {
    // Load preference
    AsyncStorage.getItem('THEME_PREFERENCE').then((val: string | null) => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setThemeModeState(val);
      }
    });
  }, []);

  const setThemeMode = async (mode: 'dark' | 'light' | 'system') => {
    setThemeModeState(mode);
    await AsyncStorage.setItem('THEME_PREFERENCE', mode);
  };

  const activeScheme = themeMode === 'system' ? systemScheme : themeMode;
  const isDark = activeScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark, setThemeMode, themeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
