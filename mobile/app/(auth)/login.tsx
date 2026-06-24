import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { 
  Coins, 
  Fingerprint, 
  MessageSquare, 
  ShieldCheck, 
  Search, 
  Building2, 
  User, 
  Lock, 
  Mail, 
  Phone, 
  PhoneCall, 
  ChevronRight,
  Clock
} from 'lucide-react-native';
import { api } from '../../services/api';

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const {
    login,
    loginWithTelegram,
    verify2FACode,
    register,
    logout,
    loginAsGuest,
    isBiometricSupported,
    isBiometricEnabled,
    authenticateBiometrics,
    setBiometricPreference,
    residentLogin,
    residentRegister
  } = useAuth();

  // Mode and Role States
  const [userRole, setUserRole] = useState<'business' | 'resident'>('business');
  const [isRegister, setIsRegister] = useState(false);
  const [loginMode, setLoginMode] = useState<'email' | 'telegram'>('email');
  
  // Business State
  const [telegramInput, setTelegramInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useBioPref, setUseBioPref] = useState(isBiometricEnabled);

  // Business Registration Form State
  const [regName, setRegName] = useState('');
  const [regTaxId, setRegTaxId] = useState('');
  const [regType, setRegType] = useState<'fop' | 'company'>('fop');
  const [regTaxSystem, setRegTaxSystem] = useState('single_tax');
  const [regGroup, setRegGroup] = useState(3);
  const [regRate, setRegRate] = useState(5);
  const [regHasEmployees, setRegHasEmployees] = useState(false);
  const [regIsVatPayer, setRegIsVatPayer] = useState(false);
  const [regIsDirector, setRegIsDirector] = useState(true);

  // Resident State
  const [osbbQuery, setOsbbQuery] = useState('');
  const [osbbResults, setOsbbResults] = useState<any[]>([]);
  const [selectedOsbb, setSelectedOsbb] = useState<any | null>(null);
  const [resPassword, setResPassword] = useState('');
  const [resFullName, setResFullName] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resEmail, setResEmail] = useState('');
  const [locLoading, setLocLoading] = useState(false);

  // Address and Role Select States for Registration
  const [streetsData, setStreetsData] = useState<any>(null);
  const [selectedStreet, setSelectedStreet] = useState('');
  const [selectedNumber, setSelectedNumber] = useState('');
  const [resRole, setResRole] = useState<'tenant' | 'owner'>('tenant');
  const [streetModalVisible, setStreetModalVisible] = useState(false);
  const [numberModalVisible, setNumberModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Fetch available OSBB addresses for registration
  useEffect(() => {
    const loadAddresses = async () => {
      if (!selectedOsbb || !isRegister) return;
      setLoadingAddresses(true);
      try {
        const data = await api.getOsbbAvailableAddresses(selectedOsbb.slug);
        setStreetsData(data);
        
        // Auto-select 'no_street' if no streets are defined
        const streetKeys = Object.keys(data?.streets || {});
        if (streetKeys.length === 0) {
          setSelectedStreet('no_street');
        } else {
          setSelectedStreet('');
        }
        setSelectedNumber('');
      } catch (err: any) {
        console.error("Failed to load available addresses", err);
        Alert.alert(
          'Помилка завантаження', 
          'Не вдалося завантажити список адрес. Будь ласка, перевірте з\'єднання з інтернетом або спробуйте пізніше.'
        );
      } finally {
        setLoadingAddresses(false);
      }
    };
    loadAddresses();
  }, [selectedOsbb, isRegister]);

  // Pending verification view state
  const [isPendingVerification, setIsPendingVerification] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState<number | null>(null);
  const [pendingOsbbPhone, setPendingOsbbPhone] = useState('');
  const [pendingOsbbSlug, setPendingOsbbSlug] = useState('');

  // Success Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  // 2FA Verification State
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [isTelegramLogin, setIsTelegramLogin] = useState(false);

  // Secure Pulse Animation state
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Automatically trigger biometrics if enabled and not in register mode or pending
    if (!isRegister && !isPendingVerification && isBiometricEnabled && isBiometricSupported && userRole === 'business') {
      setTimeout(() => {
        handleBiometrics();
      }, 500);
    }
  }, [isBiometricEnabled, isBiometricSupported, isRegister, isPendingVerification, userRole]);

  // Secure Pulse Animation hook
  useEffect(() => {
    if (isPendingVerification) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1500,
            useNativeDriver: true,
          })
        ])
      ).start();
    }
  }, [isPendingVerification]);

  // WebSocket approval status monitor
  useEffect(() => {
    if (!isPendingVerification || !pendingMemberId) return;

    const wsUrl = `wss://api.unitax.pro/ws/member/${pendingMemberId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WS connection opened to listen for member approval');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'approved') {
          Alert.alert(
            'Профіль активовано!',
            'Ваш доступ до кабінету успішно підтверджено. Проводимо автоматичний вхід.',
            [
              {
                text: 'Увійти',
                onPress: () => {
                  setIsPendingVerification(false);
                  residentLogin(pendingOsbbSlug, resPhone.trim(), resPassword.trim());
                }
              }
            ]
          );
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onerror = (e) => {
      console.warn('WS error:', e);
    };

    return () => {
      ws.close();
    };
  }, [isPendingVerification, pendingMemberId]);

  // Push notification approval status monitor
  useEffect(() => {
    if (!isPendingVerification) return;

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.status === 'approved') {
        Alert.alert(
          'Профіль активовано!',
          'Ваш доступ до кабінету успішно підтверджено. Проводимо автоматичний вхід.',
          [
            {
              text: 'Увійти',
              onPress: () => {
                setIsPendingVerification(false);
                residentLogin(pendingOsbbSlug, resPhone.trim(), resPassword.trim());
              }
            }
          ]
        );
      }
    });

    return () => subscription.remove();
  }, [isPendingVerification, pendingOsbbSlug, resPhone, resPassword]);

  const handleBiometrics = async () => {
    const success = await authenticateBiometrics();
    if (success) {
      // Authenticated! Root layout will redirect
    }
  };

  const handleLogin = async () => {
    if (!emailInput.trim() || !passwordInput.trim()) {
      Alert.alert('Помилка', 'Будь ласка, заповніть Email та пароль.');
      return;
    }

    setLoading(true);
    try {
      setIsTelegramLogin(false);
      const response = await login(emailInput.trim(), passwordInput.trim());
      
      if (response.status === 'verification_required') {
        setVerificationEmail(response.email || emailInput.trim());
        setVerificationModalVisible(true);
      } else if (response.status === 'success') {
        if (isBiometricSupported) {
          await setBiometricPreference(useBioPref);
        }
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert(
        'Помилка входу',
        e.message || 'Не вдалося увійти. Перевірте правильність Email та пароля.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRequestTempPassword = async () => {
    if (!emailInput.trim()) {
      Alert.alert('Помилка', 'Будь ласка, спочатку введіть ваш Email.');
      return;
    }

    setLoading(true);
    try {
      setIsTelegramLogin(false);
      const response = await login(emailInput.trim(), "temp_password_request");
      
      if (response.status === 'verification_required') {
        setVerificationEmail(response.email || emailInput.trim());
        setVerificationModalVisible(true);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert(
        'Помилка',
        e.message || 'Не вдалося надіслати тимчасовий код. Перевірте правильність Email.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramLogin = async () => {
    if (!telegramInput.trim()) {
      Alert.alert('Помилка', 'Будь ласка, введіть ваш Telegram ID.');
      return;
    }

    setLoading(true);
    try {
      setIsTelegramLogin(true);
      const response = await loginWithTelegram(telegramInput.trim());
      
      if (response.status === 'verification_required') {
        setVerificationEmail(response.telegram_id || telegramInput.trim());
        setVerificationModalVisible(true);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert(
        'Помилка входу',
        e.message || 'Не вдалося увійти через Telegram. Перевірте правильність Telegram ID.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FACode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Помилка', 'Введіть код підтвердження.');
      return;
    }

    setLoading(true);
    try {
      const success = await verify2FACode(verificationEmail, verificationCode.trim(), isTelegramLogin);
      if (success) {
        setVerificationModalVisible(false);
        if (isBiometricSupported) {
          await setBiometricPreference(useBioPref);
        }
      } else {
        Alert.alert('Помилка', 'Не вдалося підтвердити код. Спробуйте ще раз.');
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Помилка', e.message || 'Помилка при перевірці коду.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!emailInput.trim() || !passwordInput.trim() || !regName.trim() || !regTaxId.trim()) {
      Alert.alert('Помилка', 'Будь ласка, обов\'язково вкажіть Email, Пароль, Назву компанії та Код ЄДРПОУ/ІПН.');
      return;
    }

    if (!agreeToTerms) {
      Alert.alert('Помилка', 'Будь ласка, погодьтеся з Публічною офертою та Політикою конфіденційності для продовження.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: emailInput.trim(),
        password: passwordInput.trim(),
        phone: phoneInput.trim() || undefined,
        company_name: regName.trim(),
        tax_id: regTaxId.trim(),
        tax_system: regTaxSystem,
        group: regType === 'fop' ? regGroup : undefined,
        rate: regRate,
        has_employees: regHasEmployees,
        is_vat_payer: regIsVatPayer,
        reg_date: new Date().toISOString().split('T')[0],
      };

      await register(payload);
      
      setIsTelegramLogin(false);
      await login(emailInput.trim(), passwordInput.trim());

      if (isBiometricSupported) {
        await setBiometricPreference(useBioPref);
      }

      setNewEmail(emailInput.trim());
      setSuccessModalVisible(true);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Помилка реєстрації', e.message || 'Не вдалося зареєструвати акаунт. Перевірте вказані дані.');
    } finally {
      setLoading(false);
    }
  };

  // Autocomplete OSBB Search
  const handleSearchOsbb = async (text: string) => {
    setOsbbQuery(text);
    if (text.trim().length < 2) {
      setOsbbResults([]);
      return;
    }
    try {
      const data = await api.searchOsbb(text);
      setOsbbResults(data.results || []);
    } catch (e) {
      console.error('OSBB search query failed:', e);
    }
  };

  const handleSearchNearby = async () => {
    setLocLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync() as any;
      if (status !== 'granted') {
        Alert.alert('Помилка', 'Дозвіл на доступ до геолокації відхилено.');
        setLocLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      
      const data = await api.searchNearbyOsbb(lat, lon, 10000);
      if (data.results && data.results.length > 0) {
        setOsbbResults(data.results);
      } else {
        setOsbbResults([]);
        Alert.alert('Пошук по гео', 'Поруч з вами не знайдено активних ОСББ.');
      }
    } catch (e: any) {
      console.error('Nearby search failed:', e);
      Alert.alert('Помилка', 'Не вдалося визначити місцезнаходження.');
    } finally {
      setLocLoading(false);
    }
  };

  const selectOsbb = (osbb: any) => {
    setSelectedOsbb(osbb);
    setOsbbQuery('');
    setOsbbResults([]);
  };

  const handleResidentLogin = async () => {
    if (!selectedOsbb) {
      Alert.alert('Помилка', 'Будь ласка, знайдіть та виберіть ваше ОСББ/організацію.');
      return;
    }
    if (!resPhone.trim() || !resPassword.trim()) {
      Alert.alert('Помилка', 'Будь ласка, введіть номер телефону та пароль.');
      return;
    }

    setLoading(true);
    try {
      const response = await residentLogin(selectedOsbb.slug, resPhone.trim(), resPassword.trim());
      if (response.status === 'pending') {
        setPendingMemberId(response.member_id);
        setPendingOsbbPhone(response.phone || '');
        setPendingOsbbSlug(selectedOsbb.slug);
        setIsPendingVerification(true);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Помилка входу', e.message || 'Помилка авторизації.');
    } finally {
      setLoading(false);
    }
  };

  const handleResidentRegister = async () => {
    if (!selectedOsbb) {
      Alert.alert('Помилка', 'Будь ласка, знайдіть та виберіть ваше ОСББ/організацію.');
      return;
    }
    if (!selectedNumber) {
      Alert.alert('Помилка', 'Будь ласка, оберіть вашу адресу (номер будинку / ділянки)');
      return;
    }
    if (!resPassword.trim() || !resFullName.trim() || !resPhone.trim() || !resEmail.trim()) {
      Alert.alert('Помилка', 'Будь ласка, заповніть всі обов\'язкові поля для первинної реєстрації мешканця.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        slug: selectedOsbb.slug,
        street: selectedStreet && selectedStreet !== 'no_street' ? selectedStreet : undefined,
        house_number: selectedNumber,
        role: resRole,
        password: resPassword.trim(),
        full_name: resFullName.trim(),
        phone: resPhone.trim(),
        email: resEmail.trim().toLowerCase(),
      };
      
      const response = await residentRegister(payload);
      if (response.status === 'pending') {
        setPendingMemberId(response.member_id);
        setPendingOsbbPhone(response.phone || '');
        setPendingOsbbSlug(selectedOsbb.slug);
        setIsPendingVerification(true);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Помилка реєстрації', e.message || 'Не вдалося надіслати заявку на реєстрацію мешканця.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPending = () => {
    setIsPendingVerification(false);
    setPendingMemberId(null);
    setPendingOsbbPhone('');
    setPendingOsbbSlug('');
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await loginAsGuest();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Помилка', e.message || 'Не вдалося розпочати гостьову сесію.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBot = async () => {
    const botUrl = 'https://t.me/UniTaxUA_Bot';
    const supported = await Linking.canOpenURL(botUrl);
    if (supported) {
      await Linking.openURL(botUrl);
    } else {
      Alert.alert('Помилка', 'Не вдалося відкрити Telegram. Будь ласка, знайдіть бота @UniTaxUA_Bot вручну.');
    }
  };

  const handleCloseSuccessModal = () => {
    setSuccessModalVisible(false);
  };

  // Render Verification Screen (Pending Screen)
  if (isPendingVerification) {
    return (
      <View style={[styles.pendingContainer, { backgroundColor: '#0B0C10' }]}>
        <View style={styles.pendingCard}>
          
          {/* Animated Secure Pulse Indicator */}
          <View style={styles.pulseContainer}>
            <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }], borderColor: colors.primary + '40' }]} />
            <Animated.View style={[styles.pulseInnerCircle, { transform: [{ scale: pulseAnim }], backgroundColor: colors.primaryMuted }]} />
            <View style={[styles.pulseIconBg, { backgroundColor: colors.primary }]}>
              <ShieldCheck size={38} color="#ffffff" />
            </View>
          </View>

          <Text style={[styles.pendingTitle, { color: '#ffffff' }]}>Заявку надіслано</Text>
          
          <Text style={[styles.pendingDesc, { color: colors.textMuted }]}>
            Дякуємо за реєстрацію! Для захисту фінансових та персональних даних вашої організації, ми наразі проводимо верифікацію особового рахунку. Адміністратор підтвердить ваш профіль найближчим часом. Ви отримаєте push-сповіщення.
          </Text>

          {/* SOS Help Buttons */}
          <View style={styles.pendingActions}>
            <Button
              title="Зв'язатися з підтримкою (Telegram)"
              onPress={handleOpenBot}
              style={styles.sosButton}
            />

            {pendingOsbbPhone ? (
              <Button
                title={`Зателефонувати в ОСББ`}
                onPress={() => Linking.openURL(`tel:${pendingOsbbPhone}`)}
                variant="outline"
                style={styles.sosPhoneButton}
              />
            ) : null}

            <Pressable style={styles.pendingLogoutBtn} onPress={handleCancelPending}>
              <Text style={[styles.pendingLogoutText, { color: colors.primary }]}>
                Увійти в інший профіль
              </Text>
            </Pressable>
          </View>

        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primaryMuted }]}>
              <Coins size={44} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>UniTax</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Універсальна екосистема фінансового обліку
            </Text>
          </View>

          {/* Main Card */}
          <Card style={styles.card}>
            {/* Global User Role Selector */}
            <View style={styles.roleSegmentedContainer}>
              <Pressable
                style={[styles.roleSegment, userRole === 'business' && { backgroundColor: colors.primary }]}
                onPress={() => {
                  setUserRole('business');
                  setIsRegister(false);
                }}
              >
                <Text style={[styles.roleSegmentText, userRole === 'business' && { color: '#ffffff' }, { color: colors.text }]}>
                  Кабінет підприємства
                </Text>
              </Pressable>
              <Pressable
                style={[styles.roleSegment, userRole === 'resident' && { backgroundColor: colors.primary }]}
                onPress={() => {
                  setUserRole('resident');
                  setIsRegister(false);
                }}
              >
                <Text style={[styles.roleSegmentText, userRole === 'resident' && { color: '#ffffff' }, { color: colors.text }]}>
                  Кабінет мешканця
                </Text>
              </Pressable>
            </View>

            {userRole === 'business' ? (
              /* --- Business Login Flow --- */
              <>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {isRegister ? 'Реєстрація бізнесу' : 'Вхід у систему'}
                </Text>

                {!isRegister ? (
                  <>
                    <View style={styles.segmentedContainer}>
                      <Pressable
                        style={[styles.segment, loginMode === 'email' && { backgroundColor: colors.primary }]}
                        onPress={() => setLoginMode('email')}
                      >
                        <Text style={[styles.segmentText, loginMode === 'email' && { color: '#ffffff' }, { color: colors.text }]}>
                          Email / Пароль
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.segment, loginMode === 'telegram' && { backgroundColor: colors.primary }]}
                        onPress={() => setLoginMode('telegram')}
                      >
                        <Text style={[styles.segmentText, loginMode === 'telegram' && { color: '#ffffff' }, { color: colors.text }]}>
                          Telegram ID
                        </Text>
                      </Pressable>
                    </View>

                    {loginMode === 'email' ? (
                      <>
                        <Input
                          label="Електронна пошта"
                          placeholder="user@example.com"
                          value={emailInput}
                          onChangeText={setEmailInput}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                        <Input
                          label="Пароль"
                          placeholder="••••••••"
                          value={passwordInput}
                          onChangeText={setPasswordInput}
                          secureTextEntry
                          autoCapitalize="none"
                        />
                        <Pressable
                          onPress={handleRequestTempPassword}
                          style={{ marginTop: 2, marginBottom: 12, alignSelf: 'flex-end' }}
                        >
                          <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' }}>
                            Увійти за допомогою коду Telegram
                          </Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Input
                          label="Telegram ID"
                          placeholder="Наприклад: 123456789"
                          value={telegramInput}
                          onChangeText={setTelegramInput}
                          keyboardType="number-pad"
                        />
                        <Pressable onPress={handleOpenBot} style={{ marginBottom: 16 }}>
                          <Text style={{ fontSize: 13, color: colors.primary, textDecorationLine: 'underline' }}>
                            Як дізнатися мій ID? Відкрити бота
                          </Text>
                        </Pressable>
                      </>
                    )}

                    {isBiometricSupported && loginMode === 'email' && (
                      <View style={styles.switchRow}>
                        <View style={styles.switchLabelContainer}>
                          <Fingerprint size={20} color={colors.textMuted} style={styles.bioIcon} />
                          <Text style={[styles.switchLabel, { color: colors.text }]}>
                            Вхід за FaceID / TouchID
                          </Text>
                        </View>
                        <Switch
                          value={useBioPref}
                          onValueChange={(val) => {
                            setUseBioPref(val);
                            setBiometricPreference(val);
                          }}
                          trackColor={{ false: '#767577', true: colors.primary }}
                          thumbColor={useBioPref ? '#ffffff' : '#f4f3f4'}
                        />
                      </View>
                    )}

                    <Button
                      title="Увійти"
                      onPress={loginMode === 'email' ? handleLogin : handleTelegramLogin}
                      isLoading={loading}
                      style={styles.actionBtn}
                    />

                    {isBiometricSupported && isBiometricEnabled && loginMode === 'email' && (
                      <Button
                        title="Швидкий вхід з біометрією"
                        onPress={handleBiometrics}
                        variant="outline"
                        style={styles.secondaryBtn}
                      />
                    )}

                    <Pressable style={styles.toggleModeBtn} onPress={() => setIsRegister(true)}>
                      <Text style={[styles.toggleModeText, { color: colors.primary }]}>
                        Немає акаунта? Зареєструватися
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Input
                      label="Електронна пошта (Email)"
                      placeholder="user@example.com"
                      value={emailInput}
                      onChangeText={setEmailInput}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <Input
                      label="Пароль"
                      placeholder="Мінімум 6 символів"
                      value={passwordInput}
                      onChangeText={setPasswordInput}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                    <Input
                      label="Номер телефону (опціонально)"
                      placeholder="+380..."
                      value={phoneInput}
                      onChangeText={setPhoneInput}
                      keyboardType="phone-pad"
                    />
                    <Input
                      label="Назва компанії або ПІБ ФОП"
                      placeholder="Наприклад: ФОП Петренко Іван"
                      value={regName}
                      onChangeText={setRegName}
                    />
                    <Input
                      label="Код ЄДРПОУ / ІПН"
                      placeholder="8 або 10 цифр"
                      value={regTaxId}
                      onChangeText={setRegTaxId}
                      keyboardType="number-pad"
                      maxLength={10}
                    />

                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Тип суб'єкта</Text>
                    <View style={styles.segmentedContainer}>
                      <Pressable
                        style={[styles.segment, regType === 'fop' && { backgroundColor: colors.primary }]}
                        onPress={() => {
                          setRegType('fop');
                          if (regTaxSystem === 'non_profit') setRegTaxSystem('single_tax');
                        }}
                      >
                        <Text style={[styles.segmentText, regType === 'fop' && { color: '#ffffff' }, { color: colors.text }]}>ФОП</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.segment, regType === 'company' && { backgroundColor: colors.primary }]}
                        onPress={() => setRegType('company')}
                      >
                        <Text style={[styles.segmentText, regType === 'company' && { color: '#ffffff' }, { color: colors.text }]}>Юр. особа</Text>
                      </Pressable>
                    </View>

                    {regType === 'company' && (
                      <View style={styles.switchRow}>
                        <Text style={[styles.switchLabel, { color: colors.text }]}>Я директор (підписант)</Text>
                        <Switch
                          value={regIsDirector}
                          onValueChange={setRegIsDirector}
                          trackColor={{ false: '#767577', true: colors.primary }}
                          thumbColor={regIsDirector ? '#ffffff' : '#f4f3f4'}
                        />
                      </View>
                    )}

                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Система оподаткування</Text>
                    <View style={styles.segmentedContainer}>
                      <Pressable
                        style={[styles.segment, regTaxSystem === 'single_tax' && { backgroundColor: colors.primary }]}
                        onPress={() => setRegTaxSystem('single_tax')}
                      >
                        <Text style={[styles.segmentText, regTaxSystem === 'single_tax' && { color: '#ffffff' }, { color: colors.text }]}>Єдиний</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.segment, regTaxSystem === 'general_tax' && { backgroundColor: colors.primary }]}
                        onPress={() => setRegTaxSystem('general_tax')}
                      >
                        <Text style={[styles.segmentText, regTaxSystem === 'general_tax' && { color: '#ffffff' }, { color: colors.text }]}>Загальна</Text>
                      </Pressable>
                      {regType === 'company' && (
                        <Pressable
                          style={[styles.segment, regTaxSystem === 'non_profit' && { backgroundColor: colors.primary }]}
                          onPress={() => setRegTaxSystem('non_profit')}
                        >
                          <Text style={[styles.segmentText, regTaxSystem === 'non_profit' && { color: '#ffffff' }, { color: colors.text }]}>Неприбуткова</Text>
                        </Pressable>
                      )}
                    </View>

                    {regType === 'fop' && regTaxSystem === 'single_tax' && (
                      <>
                        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Група єдиного податку</Text>
                        <View style={styles.segmentedContainer}>
                          {[1, 2, 3].map((g) => (
                            <Pressable
                              key={g}
                              style={[styles.segment, regGroup === g && { backgroundColor: colors.primary }]}
                              onPress={() => {
                                setRegGroup(g);
                                if (g === 1 || g === 2) setRegRate(0);
                                if (g === 3) setRegRate(5);
                              }}
                            >
                              <Text style={[styles.segmentText, regGroup === g && { color: '#ffffff' }, { color: colors.text }]}>Група {g}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </>
                    )}

                    <View style={styles.switchRow}>
                      <Text style={[styles.switchLabel, { color: colors.text }]}>Наймані працівники</Text>
                      <Switch
                        value={regHasEmployees}
                        onValueChange={setRegHasEmployees}
                        trackColor={{ false: '#767577', true: colors.primary }}
                        thumbColor={regHasEmployees ? '#ffffff' : '#f4f3f4'}
                      />
                    </View>

                    <View style={styles.switchRow}>
                      <Text style={[styles.switchLabel, { color: colors.text }]}>Платник ПДВ</Text>
                      <Switch
                        value={regIsVatPayer}
                        onValueChange={setRegIsVatPayer}
                        trackColor={{ false: '#767577', true: colors.primary }}
                        thumbColor={regIsVatPayer ? '#ffffff' : '#f4f3f4'}
                      />
                    </View>

                    <View style={styles.termsRow}>
                      <Pressable
                        onPress={() => setAgreeToTerms(!agreeToTerms)}
                        style={[
                          styles.checkbox,
                          { borderColor: colors.textMuted },
                          agreeToTerms && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                      >
                        {agreeToTerms && <Text style={styles.checkboxCheck}>✓</Text>}
                      </Pressable>
                      <View style={styles.termsTextContainer}>
                        <Text style={[styles.termsText, { color: colors.textMuted }]}>
                          Я погоджуюся з{' '}
                          <Text style={[styles.linkText, { color: colors.primary }]} onPress={() => Linking.openURL('https://unitax.pro/terms')}>
                            Публічною офертою
                          </Text>{' '}
                          та{' '}
                          <Text style={[styles.linkText, { color: colors.primary }]} onPress={() => Linking.openURL('https://unitax.pro/privacy')}>
                            Політикою конфіденційності
                          </Text>
                        </Text>
                      </View>
                    </View>

                    <Button
                      title="Зареєструватися"
                      onPress={handleRegister}
                      isLoading={loading}
                      style={styles.actionBtn}
                    />

                    <Pressable style={styles.toggleModeBtn} onPress={() => setIsRegister(false)}>
                      <Text style={[styles.toggleModeText, { color: colors.primary }]}>
                        Вже є акаунт? Увійти
                      </Text>
                    </Pressable>
                  </>
                )}
              </>
            ) : (
              /* --- Resident Login Flow --- */
              <>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {isRegister ? 'Реєстрація мешканця' : 'Кабінет мешканця'}
                </Text>

                {/* Autocomplete OSBB Search Section */}
                {!selectedOsbb ? (
                  <View style={styles.searchSection}>
                    <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                      Знайдіть вашу житлову або садівничу організацію (ОСББ/СТ) за назвою або кодом ЄДРПОУ.
                    </Text>
                    
                    <View style={styles.searchInputContainer}>
                      <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
                      <Input
                        placeholder="Введіть назву або ЄДРПОУ..."
                        value={osbbQuery}
                        onChangeText={handleSearchOsbb}
                        style={styles.searchInput}
                      />
                    </View>

                    <Pressable
                      style={[styles.nearbyBtn, { borderColor: colors.primary }]}
                      onPress={handleSearchNearby}
                      disabled={locLoading}
                    >
                      {locLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={[styles.nearbyBtnText, { color: colors.primary }]}>
                          📍 Знайти найближчі ОСББ
                        </Text>
                      )}
                    </Pressable>

                    {osbbResults.length > 0 && (
                      <View style={[styles.searchResultsList, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                        {osbbResults.map((osbb) => (
                          <Pressable 
                            key={osbb.id} 
                            style={styles.searchResultItem}
                            onPress={() => selectOsbb(osbb)}
                          >
                            <Building2 size={16} color={colors.primary} style={styles.resultItemIcon} />
                            <View style={styles.resultTextContainer}>
                              <Text style={[styles.resultItemName, { color: colors.text }]}>{osbb.name}</Text>
                              <Text style={[styles.resultItemAddress, { color: colors.textMuted }]}>{osbb.address || 'Немає адреси'}</Text>
                            </View>
                            <ChevronRight size={16} color={colors.textMuted} />
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={[styles.selectedOsbbContainer, { backgroundColor: colors.primaryMuted, borderColor: colors.primary + '30' }]}>
                    <Building2 size={20} color={colors.primary} />
                    <View style={styles.selectedOsbbText}>
                      <Text style={[styles.selectedOsbbName, { color: colors.text }]}>{selectedOsbb.name}</Text>
                      <Text style={[styles.selectedOsbbSub, { color: colors.textMuted }]}>{selectedOsbb.address}</Text>
                    </View>
                    <Pressable onPress={() => setSelectedOsbb(null)} style={styles.clearSelectedOsbb}>
                      <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Змінити</Text>
                    </Pressable>
                  </View>
                )}

                {selectedOsbb && (
                  <>
                    {!isRegister ? (
                      /* Resident Login Form */
                      <>
                        <Input
                          label="Номер телефону"
                          placeholder="+380991234567"
                          value={resPhone}
                          onChangeText={setResPhone}
                          keyboardType="phone-pad"
                        />
                        <Input
                          label="Пароль"
                          placeholder="••••••••"
                          value={resPassword}
                          onChangeText={setResPassword}
                          secureTextEntry
                          autoCapitalize="none"
                        />
                        
                        <Button
                          title="Увійти як мешканець"
                          onPress={handleResidentLogin}
                          isLoading={loading}
                          style={styles.actionBtn}
                        />

                        <Pressable style={styles.toggleModeBtn} onPress={() => setIsRegister(true)}>
                          <Text style={[styles.toggleModeText, { color: colors.primary }]}>
                            Перша реєстрація у будинку
                          </Text>
                        </Pressable>
                      </>
                    ) : (
                      /* Resident Registration Form */
                      <>
                        {loadingAddresses ? (
                          <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>Завантаження списку адрес...</Text>
                          </View>
                        ) : (
                          <>
                            {streetsData?.streets && Object.keys(streetsData.streets).length > 0 && (
                              <>
                                <Text style={[styles.fieldLabel, { color: colors.text }]}>Вулиця / Об'єднання</Text>
                                <Pressable 
                                  style={[styles.selectorBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: colors.cardBorder || 'rgba(255,255,255,0.1)' }]} 
                                  onPress={() => setStreetModalVisible(true)}
                                >
                                  <Text style={[styles.selectorBtnText, { color: selectedStreet ? colors.text : colors.textMuted }]}>
                                    {selectedStreet === 'no_street' ? 'Без вулиці' : selectedStreet || 'Оберіть вулицю...'}
                                  </Text>
                                  <ChevronRight size={16} color={colors.textMuted} style={{ transform: [{ rotate: '90deg' }] }} />
                                </Pressable>
                              </>
                            )}

                            <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 12 }]}>Номер будинку / ділянки</Text>
                            <Pressable 
                              style={[styles.selectorBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: colors.cardBorder || 'rgba(255,255,255,0.1)' }, !selectedStreet && { opacity: 0.5 }]} 
                              onPress={() => {
                                if (!selectedStreet) {
                                  Alert.alert('Помилка', 'Спочатку оберіть вулицю.');
                                  return;
                                }
                                setNumberModalVisible(true);
                              }}
                              disabled={!selectedStreet}
                            >
                              <Text style={[styles.selectorBtnText, { color: selectedNumber ? colors.text : colors.textMuted }]}>
                                {selectedNumber 
                                  ? (selectedStreet && selectedStreet !== 'no_street' 
                                      ? `${selectedStreet}, ${selectedNumber}` 
                                      : `${selectedNumber}`)
                                  : 'Оберіть номер...'}
                              </Text>
                              <ChevronRight size={16} color={colors.textMuted} style={{ transform: [{ rotate: '90deg' }] }} />
                            </Pressable>
                          </>
                        )}

                        <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 12 }]}>Ваш статус (Роль)</Text>
                        <Pressable 
                          style={[styles.selectorBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: colors.cardBorder || 'rgba(255,255,255,0.1)' }]} 
                          onPress={() => setRoleModalVisible(true)}
                        >
                          <Text style={[styles.selectorBtnText, { color: colors.text }]}>
                            {resRole === 'owner' ? 'Власник' : 'Мешканець (орендар, член родини)'}
                          </Text>
                          <ChevronRight size={16} color={colors.textMuted} style={{ transform: [{ rotate: '90deg' }] }} />
                        </Pressable>

                        <View style={{ marginTop: 12 }}>
                          <Input
                            label="Повне ім'я (ПІБ)"
                            placeholder="Іванов Іван Іванович"
                            value={resFullName}
                            onChangeText={setResFullName}
                          />
                        </View>
                        <Input
                          label="Номер телефону"
                          placeholder="+380991234567"
                          value={resPhone}
                          onChangeText={setResPhone}
                          keyboardType="phone-pad"
                        />
                        <Input
                          label="Email"
                          placeholder="user@example.com"
                          value={resEmail}
                          onChangeText={setResEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                        <Input
                          label="Пароль"
                          placeholder="Мінімум 6 символів"
                          value={resPassword}
                          onChangeText={setResPassword}
                          secureTextEntry
                          autoCapitalize="none"
                        />

                        <Button
                          title="Зареєструвати особовий рахунок"
                          onPress={handleResidentRegister}
                          isLoading={loading}
                          style={styles.actionBtn}
                        />

                        <Pressable style={styles.toggleModeBtn} onPress={() => setIsRegister(false)}>
                          <Text style={[styles.toggleModeText, { color: colors.primary }]}>
                            Вже зареєстровані? Увійти
                          </Text>
                        </Pressable>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </Card>

          <Card style={[styles.infoCard, { borderColor: colors.primaryMuted }]}>
            <MessageSquare size={20} color={colors.primary} style={styles.infoIcon} />
            <View style={styles.infoTextContainer}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>Потрібна допомога?</Text>
              <Text style={[styles.infoText, { color: colors.textMuted }]}>
                UniTax дозволяє швидко управляти підприємствами та вести облік внесків ОСББ. Мешканці можуть передавати показання та сплачувати рахунки безпосередньо голові правління через Mono Pay.
              </Text>
            </View>
          </Card>
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Success Registration Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={successModalVisible}
        onRequestClose={handleCloseSuccessModal}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
            <View style={[styles.successIconBg, { backgroundColor: colors.successMuted }]}>
              <ShieldCheck size={40} color={colors.success} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.text }]}>Акаунт створено!</Text>
            <Text style={[styles.modalMessage, { color: colors.textMuted }]}>
              Реєстрація пройшла успішно. Тепер рекомендується підключити нашого Telegram-бота, щоб отримувати нагадування про податки, звіти та подавати декларації безпосередньо з чату.
            </Text>

            <Button
              title="Підключити Telegram-бота"
              onPress={handleOpenBot}
              style={styles.botBtn}
            />

            <Button
              title="Продовжити в додаток"
              onPress={handleCloseSuccessModal}
              variant="outline"
              style={styles.continueBtn}
            />
          </Card>
        </View>
      </Modal>

      {/* 2FA Verification Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={verificationModalVisible}
        onRequestClose={() => setVerificationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
            <View style={[styles.successIconBg, { backgroundColor: colors.primaryMuted }]}>
              <ShieldCheck size={40} color={colors.primary} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.text }]}>Підтвердження входу</Text>
            <Text style={[styles.modalMessage, { color: colors.textMuted }]}>
              На ваш Telegram надіслано код підтвердження. Будь ласка, введіть його для входу в систему.
            </Text>

            <Input
              label="Код підтвердження (6 цифр)"
              placeholder="123456"
              value={verificationCode}
              onChangeText={setVerificationCode}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Button
              title="Підтвердити"
              onPress={handleVerify2FACode}
              isLoading={loading}
              style={styles.botBtn}
            />

            <Button
              title="Скасувати"
              onPress={() => setVerificationModalVisible(false)}
              variant="outline"
              style={styles.continueBtn}
            />
          </Card>
        </View>
      </Modal>

      {/* Street Selection Modal */}
      <Modal
        visible={streetModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setStreetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.cardBorder, maxHeight: '80%', padding: 20 }]}>
            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 12, fontSize: 18, fontWeight: 'bold' }]}>Оберіть вулицю</Text>
            <ScrollView style={{ width: '100%', marginBottom: 12 }}>
              {streetsData?.streets && Object.keys(streetsData.streets).map((st) => (
                <Pressable
                  key={st}
                  style={({ pressed }) => [
                    styles.modalItem,
                    { borderBottomColor: isDark ? '#334155' : '#e2e8f0', paddingVertical: 14 },
                    pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                  ]}
                  onPress={() => {
                    setSelectedStreet(st);
                    setSelectedNumber('');
                    setStreetModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, { color: colors.text, fontSize: 16 }]}>{st}</Text>
                </Pressable>
              ))}
              {streetsData?.no_street_properties?.length > 0 && (
                <Pressable
                  style={({ pressed }) => [
                    styles.modalItem,
                    { borderBottomColor: isDark ? '#334155' : '#e2e8f0', paddingVertical: 14 },
                    pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                  ]}
                  onPress={() => {
                    setSelectedStreet('no_street');
                    setSelectedNumber('');
                    setStreetModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, { color: colors.text, fontSize: 16 }]}>Без вулиці</Text>
                </Pressable>
              )}
            </ScrollView>
            <Button
              title="Скасувати"
              onPress={() => setStreetModalVisible(false)}
              variant="outline"
              style={{ width: '100%' }}
            />
          </Card>
        </View>
      </Modal>

      {/* Number Selection Modal */}
      <Modal
        visible={numberModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setNumberModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.cardBorder, maxHeight: '80%', padding: 20 }]}>
            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 12, fontSize: 18, fontWeight: 'bold' }]}>Оберіть номер будинку / ділянки</Text>
            <ScrollView style={{ width: '100%', marginBottom: 12 }}>
              {selectedStreet === 'no_street'
                ? streetsData?.no_street_properties?.map((p: any, idx: number) => (
                    <Pressable
                      key={`${p.identifier}-${idx}`}
                      style={({ pressed }) => [
                        styles.modalItem,
                        { borderBottomColor: isDark ? '#334155' : '#e2e8f0', paddingVertical: 14 },
                        pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                      ]}
                      onPress={() => {
                        setSelectedNumber(p.identifier);
                        setNumberModalVisible(false);
                      }}
                    >
                      <Text style={[styles.modalItemText, { color: colors.text, fontSize: 16 }]}>
                        {p.property_type} {p.number}
                      </Text>
                    </Pressable>
                  ))
                : selectedStreet &&
                  streetsData?.streets?.[selectedStreet]?.map((p: any, idx: number) => (
                    <Pressable
                      key={`${p.identifier}-${idx}`}
                      style={({ pressed }) => [
                        styles.modalItem,
                        { borderBottomColor: isDark ? '#334155' : '#e2e8f0', paddingVertical: 14 },
                        pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                      ]}
                      onPress={() => {
                        setSelectedNumber(p.identifier);
                        setNumberModalVisible(false);
                      }}
                    >
                      <Text style={[styles.modalItemText, { color: colors.text, fontSize: 16 }]}>
                        {selectedStreet}, {p.property_type} {p.number}
                      </Text>
                    </Pressable>
                  ))}
            </ScrollView>
            <Button
              title="Скасувати"
              onPress={() => setNumberModalVisible(false)}
              variant="outline"
              style={{ width: '100%' }}
            />
          </Card>
        </View>
      </Modal>

      {/* Role Selection Modal */}
      <Modal
        visible={roleModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.cardBorder, padding: 20 }]}>
            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 16, fontSize: 18, fontWeight: 'bold' }]}>Оберіть ваш статус</Text>
            
            <Pressable
              style={({ pressed }) => [
                styles.modalItem,
                { borderBottomColor: isDark ? '#334155' : '#e2e8f0', paddingVertical: 16 },
                pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
              ]}
              onPress={() => {
                setResRole('tenant');
                setRoleModalVisible(false);
              }}
            >
              <Text style={[styles.modalItemText, { color: colors.text, fontSize: 16 }]}>Мешканець (орендар, член родини)</Text>
            </Pressable>
            
            <Pressable
              style={({ pressed }) => [
                styles.modalItem,
                { borderBottomColor: isDark ? '#334155' : '#e2e8f0', paddingVertical: 16 },
                pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
              ]}
              onPress={() => {
                setResRole('owner');
                setRoleModalVisible(false);
              }}
            >
              <Text style={[styles.modalItemText, { color: colors.text, fontSize: 16 }]}>Власник</Text>
            </Pressable>
            
            <Button
              title="Скасувати"
              onPress={() => setRoleModalVisible(false)}
              variant="outline"
              style={{ width: '100%', marginTop: 16 }}
            />
          </Card>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    opacity: 0.7,
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  selectorBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalScroll: {
    maxHeight: 250,
    width: '100%',
  },
  modalItem: {
    width: '100%',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  card: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  cardDesc: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  roleSegmentedContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: 'rgba(120, 120, 128, 0.1)',
    padding: 4,
    marginBottom: 20,
  },
  roleSegment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  roleSegmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bioIcon: {
    marginRight: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionBtn: {
    marginTop: 12,
  },
  secondaryBtn: {
    marginTop: 12,
  },
  toggleModeBtn: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  toggleModeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
    paddingLeft: 4,
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: 'rgba(120, 120, 128, 0.08)',
    padding: 2,
    marginBottom: 16,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    padding: 24,
    alignItems: 'center',
  },
  successIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  botBtn: {
    width: '100%',
    marginBottom: 12,
  },
  continueBtn: {
    width: '100%',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  checkboxCheck: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: 13,
    lineHeight: 18,
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },

  // Resident autocomplete styles
  searchSection: {
    marginVertical: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    borderColor: 'rgba(120, 120, 128, 0.2)',
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  searchResultsList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(120, 120, 128, 0.1)',
    overflow: 'hidden',
    marginTop: 4,
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(120, 120, 128, 0.08)',
  },
  resultItemIcon: {
    marginRight: 10,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultItemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultItemAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  selectedOsbbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
  },
  selectedOsbbText: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  selectedOsbbName: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectedOsbbSub: {
    fontSize: 12,
    marginTop: 2,
  },
  clearSelectedOsbb: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },

  // Pending approval screen styles
  pendingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pendingCard: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(23, 29, 43, 0.75)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  pulseContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  pulseCircle: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
  },
  pulseInnerCircle: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  pulseIconBg: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  pendingTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  pendingDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  pendingActions: {
    width: '100%',
    gap: 12,
  },
  sosButton: {
    width: '100%',
  },
  sosPhoneButton: {
    width: '100%',
  },
  pendingLogoutBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  pendingLogoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
  nearbyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 8,
    gap: 6,
  },
  nearbyBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
