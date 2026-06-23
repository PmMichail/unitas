import React from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, Alert, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { User, Moon, Sun, Fingerprint, LogOut, Info, Home, ShieldCheck } from 'lucide-react-native';

export default function ResidentSettings() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const {
    memberData,
    memberProfileSlug,
    logout,
    isBiometricSupported,
    isBiometricEnabled,
    setBiometricPreference,
  } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Вихід з кабінету',
      'Ви впевнені, що хочете вийти з кабінету мешканця?',
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Вийти', style: 'destructive', onPress: () => logout() },
      ]
    );
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
        
        {/* Resident Account Info */}
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primaryMuted }]}>
              <User size={24} color={colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.title, { color: colors.text }]}>Профіль мешканця</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {memberData?.owner_name || 'Співвласник'}
              </Text>
            </View>
          </View>
          
          <View style={[styles.infoList, { borderTopColor: colors.cardBorder }]}>
            <View style={styles.infoRow}>
              <Home size={16} color={colors.textMuted} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Об'єкт:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {memberData?.property_type || 'кв.'} {memberData?.identifier}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <ShieldCheck size={16} color={colors.textMuted} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Рахунок:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {memberData?.account_number || 'Не визначено'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Info size={16} color={colors.textMuted} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Організація (slug):</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {memberProfileSlug}
              </Text>
            </View>
          </View>
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
                <View style={styles.textContainer}>
                  <Text style={[styles.switchTitle, { color: colors.text }]}>
                    Вхід за FaceID / TouchID
                  </Text>
                  <Text style={[styles.switchDesc, { color: colors.textMuted }]}>
                    Швидкий вхід до кабінету мешканця
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
              <Text style={[styles.infoTitle, { color: colors.text }]}>Про кабінет UniTax</Text>
              <Text style={[styles.infoDesc, { color: colors.textMuted }]}>
                Версія: 1.0.0{'\n'}
                Платформа: {Platform.OS === 'ios' ? 'iOS' : 'Android'}{'\n'}
                Безпечне ізольоване підключення
              </Text>
            </View>
          </View>
        </Card>

        {/* Logout Button */}
        <Button
          title="Вийти з кабінету"
          onPress={handleLogout}
          variant="danger"
          style={styles.logoutBtn}
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
  infoList: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    width: 140,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
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
});
