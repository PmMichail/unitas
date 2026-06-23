import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../services/api';

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync() as any;
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync() as any;
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
      
    if (!projectId) {
      console.log('Project ID not found in Constants');
      return null;
    }
    
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return tokenData.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

interface AuthContextType {
  telegramId: string | null; // Залишаємо для сумісності (зберігатиме Email або Telegram ID)
  userEmail: string | null;
  memberToken: string | null;
  memberProfileSlug: string | null;
  memberData: any | null;
  isResident: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBiometricSupported: boolean;
  isBiometricEnabled: boolean;
  login: (email: string, password: string) => Promise<{ status: 'success' | 'verification_required'; email?: string; message: string }>;
  residentLogin: (slug: string, account_number: string, password: string) => Promise<any>;
  residentRegister: (payload: any) => Promise<any>;
  loginWithTelegram: (telegramId: string) => Promise<{ status: 'verification_required'; telegram_id: string; message: string }>;
  verify2FACode: (identifier: string, code: string, isTelegram?: boolean) => Promise<boolean>;
  register: (payload: any) => Promise<any>;
  logout: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  authenticateBiometrics: () => Promise<boolean>;
  setBiometricPreference: (enabled: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [memberToken, setMemberToken] = useState<string | null>(null);
  const [memberProfileSlug, setMemberProfileSlug] = useState<string | null>(null);
  const [memberData, setMemberData] = useState<any | null>(null);
  const [isResident, setIsResident] = useState<boolean>(false);
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

      // Перевірка сесії мешканця
      const storedMemberToken = await SecureStore.getItemAsync('MEMBER_TOKEN');
      const storedMemberSlug = await SecureStore.getItemAsync('MEMBER_SLUG');
      const storedMemberData = await SecureStore.getItemAsync('MEMBER_DATA');
      if (storedMemberToken) {
        setMemberToken(storedMemberToken);
        setMemberProfileSlug(storedMemberSlug);
        setIsResident(true);
        if (storedMemberData) {
          try {
            setMemberData(JSON.parse(storedMemberData));
          } catch (e) {
            console.error('Error parsing stored member data:', e);
          }
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

  const residentLogin = async (slug: string, accountNumber: string, passwordString: string): Promise<any> => {
    try {
      const pushToken = await registerForPushNotificationsAsync();
      const response = await api.memberLogin({
        slug,
        account_number: accountNumber,
        password: passwordString,
        push_token: pushToken || undefined,
        platform: Platform.OS,
      });
      if (response.status === 'success') {
        const { token: tokenVal, member: memberObj } = response;
        await SecureStore.setItemAsync('MEMBER_TOKEN', tokenVal);
        await SecureStore.setItemAsync('MEMBER_SLUG', slug);
        await SecureStore.setItemAsync('MEMBER_DATA', JSON.stringify(memberObj));
        setMemberToken(tokenVal);
        setMemberProfileSlug(slug);
        setMemberData(memberObj);
        setIsResident(true);
      }
      return response;
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || 'Не вдалося увійти як мешканець';
      throw new Error(errMsg);
    }
  };

  const residentRegister = async (payload: any): Promise<any> => {
    try {
      const pushToken = await registerForPushNotificationsAsync();
      const fullPayload = {
        ...payload,
        push_token: pushToken || undefined,
        platform: Platform.OS,
      };
      const response = await api.memberRegister(fullPayload);
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
      await SecureStore.deleteItemAsync('MEMBER_TOKEN');
      await SecureStore.deleteItemAsync('MEMBER_SLUG');
      await SecureStore.deleteItemAsync('MEMBER_DATA');
      setTelegramId(null);
      setUserEmail(null);
      setIsBiometricEnabled(false);
      setMemberToken(null);
      setMemberProfileSlug(null);
      setMemberData(null);
      setIsResident(false);
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  const loginAsGuest = async () => {
    try {
      const response = await api.loginAsGuest();
      const { telegram_id } = response;
      await SecureStore.setItemAsync('TELEGRAM_ID', telegram_id);
      setTelegramId(telegram_id);
      setUserEmail(null);
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || 'Не вдалося увійти як гість';
      throw new Error(errMsg);
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
        memberToken,
        memberProfileSlug,
        memberData,
        isResident,
        isAuthenticated: !!telegramId || !!memberToken,
        isLoading,
        isBiometricSupported,
        isBiometricEnabled,
        login,
        residentLogin,
        residentRegister,
        loginWithTelegram,
        verify2FACode,
        register,
        logout,
        loginAsGuest,
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
