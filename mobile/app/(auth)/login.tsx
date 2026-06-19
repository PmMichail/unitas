import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Coins, Fingerprint, MessageSquare, ShieldCheck } from 'lucide-react-native';
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
  } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [loginMode, setLoginMode] = useState<'email' | 'telegram'>('email');
  const [telegramInput, setTelegramInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useBioPref, setUseBioPref] = useState(isBiometricEnabled);

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regTaxId, setRegTaxId] = useState('');
  const [regType, setRegType] = useState<'fop' | 'company'>('fop');
  const [regTaxSystem, setRegTaxSystem] = useState('single_tax');
  const [regGroup, setRegGroup] = useState(3);
  const [regRate, setRegRate] = useState(5);
  const [regHasEmployees, setRegHasEmployees] = useState(false);
  const [regIsVatPayer, setRegIsVatPayer] = useState(false);
  const [regIsDirector, setRegIsDirector] = useState(true);

  // Success Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  // 2FA Verification State
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [isTelegramLogin, setIsTelegramLogin] = useState(false);

  useEffect(() => {
    // Automatically trigger biometrics if enabled and not in register mode
    if (!isRegister && isBiometricEnabled && isBiometricSupported) {
      setTimeout(() => {
        handleBiometrics();
      }, 500);
    }
  }, [isBiometricEnabled, isBiometricSupported, isRegister]);

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

      // Register account on backend
      await register(payload);
      
      // Auto login
      setIsTelegramLogin(false);
      await login(emailInput.trim(), passwordInput.trim());

      // Save biometric preferences
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
            Ваш універсальний податковий AI-асистент
          </Text>
        </View>

        {!isRegister ? (
          /* Login View */
          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Вхід у систему</Text>

            {/* Login Mode Switcher */}
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
                <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                  Введіть ваш Email та пароль для авторизації в UniTax.
                </Text>

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
                <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                  Введіть ваш Telegram ID. Код підтвердження буде надіслано в чат з ботом.
                </Text>

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
          </Card>
        ) : (
          /* Registration View */
          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Реєстрація</Text>
            <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
              Створіть свій податковий акаунт та перший бізнес-профіль.
            </Text>

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
                  if (regTaxSystem === 'non_profit') {
                    setRegTaxSystem('single_tax');
                  }
                }}
              >
                <Text style={[styles.segmentText, regType === 'fop' && { color: '#ffffff' }, { color: colors.text }]}>
                  ФОП
                </Text>
              </Pressable>
              <Pressable
                style={[styles.segment, regType === 'company' && { backgroundColor: colors.primary }]}
                onPress={() => setRegType('company')}
              >
                <Text style={[styles.segmentText, regType === 'company' && { color: '#ffffff' }, { color: colors.text }]}>
                  Юридична особа
                </Text>
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
                <Text style={[styles.segmentText, regTaxSystem === 'single_tax' && { color: '#ffffff' }, { color: colors.text }]}>
                  Єдиний
                </Text>
              </Pressable>
              <Pressable
                style={[styles.segment, regTaxSystem === 'general_tax' && { backgroundColor: colors.primary }]}
                onPress={() => setRegTaxSystem('general_tax')}
              >
                <Text style={[styles.segmentText, regTaxSystem === 'general_tax' && { color: '#ffffff' }, { color: colors.text }]}>
                  Загальна
                </Text>
              </Pressable>
              {regType === 'company' && (
                <Pressable
                  style={[styles.segment, regTaxSystem === 'non_profit' && { backgroundColor: colors.primary }]}
                  onPress={() => setRegTaxSystem('non_profit')}
                >
                  <Text style={[styles.segmentText, regTaxSystem === 'non_profit' && { color: '#ffffff' }, { color: colors.text }]}>
                    Неприбуткова
                  </Text>
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
                      <Text style={[styles.segmentText, regGroup === g && { color: '#ffffff' }, { color: colors.text }]}>
                        Група {g}
                      </Text>
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

            {isBiometricSupported && (
              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Fingerprint size={20} color={colors.textMuted} style={styles.bioIcon} />
                  <Text style={[styles.switchLabel, { color: colors.text }]}>
                    Вхід за FaceID / TouchID
                  </Text>
                </View>
                <Switch
                  value={useBioPref}
                  onValueChange={setUseBioPref}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor={useBioPref ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            )}

            {/* Agreement with Terms & Public Offer */}
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
                  <Text
                    style={[styles.linkText, { color: colors.primary }]}
                    onPress={() => Linking.openURL('https://unitax.pro/terms')}
                  >
                    Публічною офертою (договором про надання послуг)
                  </Text>{' '}
                  та{' '}
                  <Text
                    style={[styles.linkText, { color: colors.primary }]}
                    onPress={() => Linking.openURL('https://unitax.pro/privacy')}
                  >
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
          </Card>
        )}

        <Card style={[styles.infoCard, { borderColor: colors.primaryMuted }]}>
          <MessageSquare size={20} color={colors.primary} style={styles.infoIcon} />
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Потрібна допомога?</Text>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              UniTax дозволяє авторизуватись за допомогою Email та пароля. Для вашої безпеки ви можете налаштувати 2FA вхід через Telegram у налаштуваннях профілю після входу.
            </Text>
          </View>
        </Card>
      </ScrollView>
      </TouchableWithoutFeedback>

      {/* Success Registration / Telegram Bot Linking Modal */}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
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
    backgroundColor: 'rgba(120, 120, 128, 0.1)',
    padding: 2,
    marginBottom: 8,
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
});
