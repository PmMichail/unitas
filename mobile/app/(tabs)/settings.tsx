import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, Alert, Platform, Linking, Clipboard, Pressable } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { User, Moon, Sun, Fingerprint, LogOut, Info, Laptop, Globe } from 'lucide-react-native';
import { api } from '../../services/api';

import ResidentSettings from '../../components/resident/ResidentSettings';

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const {
    telegramId,
    logout,
    isBiometricSupported,
    isBiometricEnabled,
    setBiometricPreference,
    isResident,
  } = useAuth();

  if (isResident) {
    return <ResidentSettings />;
  }

  const [userConfig, setUserConfig] = useState<{ email: string; telegram_id: string | null; is_telegram_linked: boolean; link_code: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadUserConfig = async () => {
    if (!telegramId || isResident) return;
    setLoading(true);
    try {
      const data = await api.getCurrentUser(telegramId);
      setUserConfig(data);
    } catch (e) {
      console.error('Failed to load user config', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isResident) {
      loadUserConfig();
    }
  }, [telegramId, isResident]);

  const handleLogout = () => {
    Alert.alert(
      'Вихід з акаунту',
      'Ви впевнені, що хочете вийти? Ваші авторизаційні дані буде видалено з цього пристрою.',
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Вийти', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Видалення акаунту',
      'Увага! Ви дійсно бажаєте безповоротно видалити свій акаунт та всі пов\'язані дані (профілі, підприємства, працівників та виписки)? Цю дію неможливо скасувати.',
      [
        { text: 'Скасувати', style: 'cancel' },
        { 
          text: 'Видалити акаунт', 
          style: 'destructive', 
          onPress: async () => {
            if (!telegramId) return;
            try {
              await api.deleteUserAccount(telegramId);
              await logout();
              Alert.alert('Успіх', 'Ваш акаунт успішно видалено.');
            } catch (e: any) {
              console.error('Failed to delete account', e);
              const errMsg = e.response?.data?.detail || 'Не вдалося видалити акаунт';
              Alert.alert('Помилка', errMsg);
            }
          } 
        },
      ]
    );
  };

  const handleCopyLinkCommand = () => {
    if (telegramId) {
      const code = userConfig?.link_code || '123456';
      Clipboard.setString(`/link ${telegramId} ${code}`);
      Alert.alert('Скопійовано', 'Команду для підключення скопійовано в буфер');
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

  const getThemeLabel = () => {
    switch (themeMode) {
      case 'dark':
        return 'Темна';
      case 'light':
        return 'Світла';
    }
  };

  return (

    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        
        {/* User Account Info */}
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primaryMuted }]}>
              <User size={24} color={colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.title, { color: colors.text }]}>Ваш акаунт</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Email: {telegramId}
              </Text>
            </View>
          </View>
        </Card>

        {/* Telegram Linking Card */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Синхронізація з Telegram</Text>
          <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
            Бот надсилає коди підтвердження для входу та сповіщення про податки.
          </Text>

          {userConfig?.is_telegram_linked ? (
            <View style={styles.linkedContainer}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.statusText, { color: colors.text }]}>
                  Підключено: Telegram ID {userConfig.telegram_id}
                </Text>
              </View>
              <Button
                title="Відкрити чат з ботом"
                onPress={handleOpenBot}
                variant="outline"
                style={styles.tgBtn}
              />
            </View>
          ) : (
            <View style={styles.unlinkedContainer}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: colors.textMuted }]} />
                <Text style={[styles.statusText, { color: colors.text }]}>Бот не підключений</Text>
              </View>
              
              <Text style={[styles.instructionText, { color: colors.textMuted }]}>
                Щоб підключити бота та налаштувати 2FA, перейдіть до бота та надішліть команду з кодом безпеки:
              </Text>
              
              <Pressable style={[styles.codeBox, { backgroundColor: colors.primaryMuted }]} onPress={handleCopyLinkCommand}>
                <Text style={[styles.codeBoxText, { color: colors.primary }]}>
                  /link {telegramId} {userConfig?.link_code || '123456'}
                </Text>
                <Text style={[styles.copyHint, { color: colors.primary }]}>
                  (натисніть, щоб скопіювати команду)
                </Text>
              </Pressable>

              <Button
                title="Підключити Telegram-бота"
                onPress={handleOpenBot}
                style={styles.tgBtn}
              />
            </View>
          )}
        </Card>


        {/* Theme Settings */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Тема інтерфейсу</Text>
          <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
            Поточний режим: {getThemeLabel()}
          </Text>

          <View style={styles.themeOptions}>
            <Button
              title="Темна"
              onPress={() => setThemeMode('dark')}
              variant={themeMode === 'dark' ? 'primary' : 'outline'}
              style={styles.themeBtn}
              textStyle={styles.themeBtnText}
            />
            <Button
              title="Світла"
              onPress={() => setThemeMode('light')}
              variant={themeMode === 'light' ? 'primary' : 'outline'}
              style={styles.themeBtn}
              textStyle={styles.themeBtnText}
            />
          </View>
        </Card>

        {/* Biometrics Settings */}
        {isBiometricSupported && (
          <Card style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Fingerprint size={24} color={colors.text} style={styles.settingIcon} />
                <View>
                  <Text style={[styles.switchTitle, { color: colors.text }]}>
                    Вхід за FaceID / TouchID
                  </Text>
                  <Text style={[styles.switchDesc, { color: colors.textMuted }]}>
                    Швидкий вхід без введення ID
                  </Text>
                </View>
              </View>
              <Switch
                value={isBiometricEnabled}
                onValueChange={(val) => setBiometricPreference(val)}
                trackColor={{ false: '#767577', true: colors.primary }}
                thumbColor={isBiometricEnabled ? '#ffffff' : '#f4f3f4'}
              />
            </View>
          </Card>
        )}

        {/* System Info */}
        <Card style={styles.card}>
          <View style={styles.row}>
            <Info size={24} color={colors.textMuted} style={styles.settingIcon} />
            <View style={styles.textContainer}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>Про UniTax</Text>
              <Text style={[styles.infoDesc, { color: colors.textMuted }]}>
                Версія мобільного додатка: 1.0.0{'\n'}
                Платформа: {Platform.OS === 'ios' ? 'iOS' : 'Android'} (Expo SDK 54)
              </Text>
            </View>
          </View>
        </Card>

        {/* Transition to website Card */}
        <Card style={styles.card}>
          <View style={styles.row}>
            <Globe size={24} color={colors.primary} style={styles.settingIcon} />
            <View style={styles.textContainer}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>Веб-сайт UniTax</Text>
              <Text style={[styles.infoDesc, { color: colors.textMuted, marginBottom: 8 }]}>
                На нашому веб-сайті доступно більше функцій, включаючи повний кабінет, завантаження звітів, рахунки, акти та правову інформацію.
              </Text>
              <Button
                title="Перейти на unitax.pro"
                onPress={() => Linking.openURL('https://unitax.pro')}
                variant="outline"
                style={{ borderColor: colors.primary }}
                textStyle={{ color: colors.primary }}
              />
            </View>
          </View>
        </Card>

        {/* Logout Button */}
        <Button
          title="Вийти з акаунту"
          onPress={handleLogout}
          variant="danger"
          style={styles.logoutBtn}
        />

        {/* Delete Account Button */}
        <Button
          title="Видалити акаунт"
          onPress={handleDeleteAccount}
          variant="outline"
          style={[styles.logoutBtn, { marginTop: 12, borderColor: colors.error }]}
          textStyle={{ color: colors.error }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    padding: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: 16,
  },
  themeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  themeBtn: {
    flex: 1,
    marginHorizontal: 4,
    minHeight: 38,
    paddingVertical: 8,
  },
  themeBtnText: {
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 16,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  switchDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  logoutBtn: {
    marginTop: 16,
    marginBottom: 40,
  },
  linkedContainer: {
    marginTop: 8,
  },
  unlinkedContainer: {
    marginTop: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tgBtn: {
    marginTop: 8,
  },
  instructionText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  codeBox: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  codeBoxText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
  },
  copyHint: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.8,
  },
});

