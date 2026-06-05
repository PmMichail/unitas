import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';
import { api } from '../services/api';

interface AuthContextType {
  telegramId: string | null; // Залишаємо для сумісності (зберігатиме Email або Telegram ID)
  userEmail: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBiometricSupported: boolean;
  isBiometricEnabled: boolean;
  login: (email: string, password: string) => Promise<{ status: 'success' | 'verification_required'; email?: string; message: string }>;
  loginWithTelegram: (telegramId: string) => Promise<{ status: 'verification_required'; telegram_id: string; message: string }>;
  verify2FACode: (identifier: string, code: string, isTelegram?: boolean) => Promise<boolean>;
  register: (payload: any) => Promise<any>;
  logout: () => Promise<void>;
  authenticateBiometrics: () => Promise<boolean>;
  setBiometricPreference: (enabled: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  useEffect(() => {
    checkAuthAndBiometrics();
  }, []);

  const checkAuthAndBiometrics = async () => {
    try {
      // Перевірка підтримки біометрії
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricSupported(hasHardware && isEnrolled);

      // Отримання налаштувань біометрії
      const bioPref = await SecureStore.getItemAsync('BIOMETRICS_ENABLED');
      setIsBiometricEnabled(bioPref === 'true');

      // Перевірка збереженого ID/Email сесії
      const storedId = await SecureStore.getItemAsync('TELEGRAM_ID');
      if (storedId) {
        setTelegramId(storedId);
        if (storedId.includes('@')) {
          setUserEmail(storedId);
        }
      }
    } catch (e) {
      console.error('Failed to load auth state', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ status: 'success' | 'verification_required'; email?: string; message: string }> => {
    if (!email || email.trim() === '' || !password || password.trim() === '') {
      throw new Error('Будь ласка, введіть Email та пароль');
    }

    try {
      const response = await api.login(email, password);
      
      if (response.status === 'success') {
        const userEmailClean = response.email || email.trim().toLowerCase();
        await SecureStore.setItemAsync('TELEGRAM_ID', userEmailClean);
        setTelegramId(userEmailClean);
        setUserEmail(userEmailClean);
      }
      return response;
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || 'Не вдалося увійти';
      throw new Error(errMsg);
    }
  };

  const loginWithTelegram = async (tgId: string): Promise<{ status: 'verification_required'; telegram_id: string; message: string }> => {
    if (!tgId || tgId.trim() === '') {
      throw new Error('Будь ласка, введіть Telegram ID');
    }
    try {
      const response = await api.telegramLogin(tgId);
      return response;
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || 'Не вдалося надіслати код підтвердження';
      throw new Error(errMsg);
    }
  };

  const verify2FACode = async (identifier: string, code: string, isTelegram: boolean = false): Promise<boolean> => {
    try {
      const response = await api.verify2FACode(identifier, code, isTelegram);
      if (response.status === 'success') {
        const storedClean = isTelegram ? (response.telegram_id || identifier) : (response.email || identifier);
        const sessionClean = storedClean.trim().toLowerCase();
        await SecureStore.setItemAsync('TELEGRAM_ID', sessionClean);
        setTelegramId(sessionClean);
        if (!isTelegram) {
          setUserEmail(sessionClean);
        } else {
          setUserEmail(null);
        }
        return true;
      }
      return false;
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || 'Невірний код підтвердження';
      Alert.alert('Помилка', errMsg);
      return false;
    }
  };

  const register = async (payload: any): Promise<any> => {
    try {
      const response = await api.registerUser(payload);
      return response;
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || 'Помилка реєстрації';
      throw new Error(errMsg);
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('TELEGRAM_ID');
      await SecureStore.deleteItemAsync('BIOMETRICS_ENABLED');
      setTelegramId(null);
      setUserEmail(null);
      setIsBiometricEnabled(false);
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  const setBiometricPreference = async (enabled: boolean) => {
    try {
      await SecureStore.setItemAsync('BIOMETRICS_ENABLED', enabled ? 'true' : 'false');
      setIsBiometricEnabled(enabled);
    } catch (e) {
      console.error('Error saving biometric preference', e);
    }
  };

  const authenticateBiometrics = async (): Promise<boolean> => {
    if (!isBiometricSupported) return false;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Авторизація в UniTax',
        cancelLabel: 'Скасувати',
        disableDeviceFallback: false,
      });

      if (result.success) {
        const storedId = await SecureStore.getItemAsync('TELEGRAM_ID');
        if (storedId) {
          setTelegramId(storedId);
          if (storedId.includes('@')) {
            setUserEmail(storedId);
          }
          return true;
        } else {
          Alert.alert('Помилка', 'Не знайдено збереженого профілю для входу');
          return false;
        }
      }
      return false;
    } catch (e) {
      console.error('Biometric authentication failed', e);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        telegramId,
        userEmail,
        isAuthenticated: !!telegramId,
        isLoading,
        isBiometricSupported,
        isBiometricEnabled,
        login,
        loginWithTelegram,
        verify2FACode,
        register,
        logout,
        authenticateBiometrics,
        setBiometricPreference,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
