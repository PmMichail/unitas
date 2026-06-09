import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { api, ProfileData } from '../../services/api';
import { haptics } from '../../services/haptics';
import { useFocusEffect } from 'expo-router';
import {
  Plus,
  Briefcase,
  Trash2,
  X,
  Users,
  Coins,
  FileText,
  Calendar,
  Mail,
  Send,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function InvoicesScreen() {
  const { colors } = useTheme();
  const { telegramId } = useAuth();
  const insets = useSafeAreaInsets();

  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Active Tab: 'schedules' (регулярні), 'oneoff' (разові), 'history' (архів)
  const [invActiveTab, setInvActiveTab] = useState<'schedules' | 'oneoff' | 'history'>('schedules');
  const [invoiceFormVisible, setInvoiceFormVisible] = useState(false);

  // Lists
  const [recurringInvoices, setRecurringInvoices] = useState<any[]>([]);
  const [invoicesHistory, setInvoicesHistory] = useState<any[]>([]);

  // Recurring form state
  const [invClientName, setInvClientName] = useState('');
  const [invClientTaxId, setInvClientTaxId] = useState('');
  const [invClientAddress, setInvClientAddress] = useState('');
  const [invDocumentType, setInvDocumentType] = useState('act');
  const [invClientEmail, setInvClientEmail] = useState('');
  const [invClientTg, setInvClientTg] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invServiceName, setInvServiceName] = useState('');
  const [invIncludeAct, setInvIncludeAct] = useState(true);
  const [invPeriodicity, setInvPeriodicity] = useState<'monthly' | 'specific'>('monthly');
  const [invSendMonth, setInvSendMonth] = useState<number | null>(null);
  const [invSendDay, setInvSendDay] = useState('1');

  // One-off form state
  const [oneoffClientName, setOneoffClientName] = useState('');
  const [oneoffClientTaxId, setOneoffClientTaxId] = useState('');
  const [oneoffClientAddress, setOneoffClientAddress] = useState('');
  const [oneoffDocumentType, setOneoffDocumentType] = useState('act');
  const [oneoffClientEmail, setOneoffClientEmail] = useState('');
  const [oneoffClientTg, setOneoffClientTg] = useState('');
  const [oneoffAmount, setOneoffAmount] = useState('');
  const [oneoffServiceName, setOneoffServiceName] = useState('');
  const [oneoffIncludeAct, setOneoffIncludeAct] = useState(true);

  // Send confirmation dialog states
  const [sendConfirmVisible, setSendConfirmVisible] = useState(false);
  const [targetInvoiceId, setTargetInvoiceId] = useState<number | null>(null);
  const [customDateEnabled, setCustomDateEnabled] = useState(false);
  const [customSendDay, setCustomSendDay] = useState('');
  const [customSendMonth, setCustomSendMonth] = useState('');
  const [sendIncludeAct, setSendIncludeAct] = useState(true);

  // Load profiles and history on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [telegramId])
  );

  const loadData = async () => {
    if (!telegramId) return;
    setLoading(true);
    try {
      const profileList = await api.getProfiles(telegramId);
      setProfiles(profileList);

      if (profileList.length > 0) {
        const storedProfileId = await AsyncStorage.getItem('SELECTED_PROFILE_ID');
        const match = profileList.find((p) => p.id.toString() === storedProfileId);
        const activeProfile = match || profileList[0];
        setSelectedProfile(activeProfile);
        await fetchInvoicesData(activeProfile.id);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити дані рахунків');
      setLoading(false);
    }
  };

  const fetchInvoicesData = async (profileId: number) => {
    setInvoicesLoading(true);
    try {
      const [schedules, history] = await Promise.all([
        api.getRecurringInvoices(profileId),
        api.getInvoicesHistory(profileId),
      ]);
      setRecurringInvoices(schedules);
      setInvoicesHistory(history);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити списки рахунків');
    } finally {
      setInvoicesLoading(false);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedProfile) {
      await fetchInvoicesData(selectedProfile.id);
    } else {
      await loadData();
    }
  };

  const handleDownloadInvoicePdf = async (invoiceId: number) => {
    try {
      const url = api.getInvoicePdfUrl(invoiceId);
      await Linking.openURL(url);
      haptics.light();
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалося відкрити рахунок');
    }
  };

  const handleDownloadDocumentPdf = async (invoiceId: number) => {
    try {
      const url = api.getInvoiceDocumentPdfUrl(invoiceId);
      await Linking.openURL(url);
      haptics.light();
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалося відкрити супутній документ');
    }
  };

  const handleCreateInvoiceDocument = async (invoiceId: number, docType: string) => {
    try {
      setInvoicesLoading(true);
      await api.createInvoiceDocument(invoiceId, docType);
      haptics.success();
      if (selectedProfile) {
        await fetchInvoicesData(selectedProfile.id);
      }
      Alert.alert('Успіх', docType === 'waybill' ? 'Накладну успішно створено' : 'Акт успішно створено');
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося створити документ');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleSaveRecurringInvoice = async () => {
    if (!invClientEmail.trim() || !invAmount.trim() || !invServiceName.trim() || !invSendDay.trim()) {
      Alert.alert('Помилка', "Будь ласка, заповніть всі обов'язкові поля (*)");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(invClientEmail.trim())) {
      Alert.alert('Помилка', 'Введіть коректну адресу електронної пошти');
      return;
    }

    const amountNum = parseFloat(invAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Помилка', 'Введіть коректну суму рахунку');
      return;
    }

    const sendDayNum = parseInt(invSendDay, 10);
    if (isNaN(sendDayNum) || sendDayNum < 1 || sendDayNum > 28) {
      Alert.alert('Помилка', 'День відправки має бути числом від 1 до 28');
      return;
    }

    if (!selectedProfile) return;

    setInvoicesLoading(true);
    try {
      await api.createRecurringInvoice({
        profile_id: selectedProfile.id,
        client_email: invClientEmail.trim(),
        client_telegram_id: invClientTg.trim() || undefined,
        amount: amountNum,
        service_name: invServiceName.trim(),
        send_day: sendDayNum,
        include_act: invIncludeAct,
        send_month: invSendMonth,
        client_name: invClientName.trim() || undefined,
        client_tax_id: invClientTaxId.trim() || undefined,
        document_type: invDocumentType,
        client_address: invClientAddress.trim() || undefined,
      });
      haptics.success();
      Alert.alert('Успіх', 'Шаблон регулярного рахунку створено');
      setInvoiceFormVisible(false);
      
      // Reset fields
      setInvClientEmail('');
      setInvClientTg('');
      setInvAmount('');
      setInvServiceName('');
      setInvIncludeAct(true);
      setInvSendDay('1');
      setInvPeriodicity('monthly');
      setInvSendMonth(null);
      setInvClientName('');
      setInvClientTaxId('');
      setInvClientAddress('');
      setInvDocumentType('act');
      
      fetchInvoicesData(selectedProfile.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося зберегти шаблон');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleSendOneoffInvoice = async () => {
    if (!oneoffClientEmail.trim() || !oneoffAmount.trim() || !oneoffServiceName.trim()) {
      Alert.alert('Помилка', "Будь ласка, заповніть всі обов'язкові поля (*)");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(oneoffClientEmail.trim())) {
      Alert.alert('Помилка', 'Введіть коректну адресу електронної пошти');
      return;
    }

    const amountNum = parseFloat(oneoffAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Помилка', 'Введіть коректну суму рахунку');
      return;
    }

    if (!selectedProfile) return;

    try {
      setInvoicesLoading(true);
      await api.sendOneoffInvoice({
        profile_id: selectedProfile.id,
        client_email: oneoffClientEmail.trim(),
        client_telegram_id: oneoffClientTg.trim() || undefined,
        amount: amountNum,
        service_name: oneoffServiceName.trim(),
        include_act: oneoffIncludeAct,
        client_name: oneoffClientName.trim() || undefined,
        client_tax_id: oneoffClientTaxId.trim() || undefined,
        document_type: oneoffDocumentType,
        client_address: oneoffClientAddress.trim() || undefined,
      });
      haptics.success();
      Alert.alert('Успіх', 'Рахунок успішно надіслано клієнту!');
      
      // Clear inputs
      setOneoffClientEmail('');
      setOneoffClientTg('');
      setOneoffAmount('');
      setOneoffServiceName('');
      setOneoffIncludeAct(true);
      setOneoffClientName('');
      setOneoffClientTaxId('');
      setOneoffClientAddress('');
      setOneoffDocumentType('act');
      
      setInvActiveTab('history');
      fetchInvoicesData(selectedProfile.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося надіслати рахунок');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleDeleteRecurringInvoice = (id: number) => {
    if (!selectedProfile) return;
    Alert.alert(
      'Видалення шаблону',
      'Ви впевнені, що хочете видалити цей регулярний рахунок?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              setInvoicesLoading(true);
              await api.deleteRecurringInvoice(id);
              haptics.success();
              Alert.alert('Успіх', 'Шаблон видалено');
              fetchInvoicesData(selectedProfile.id);
            } catch (e) {
              console.error(e);
              Alert.alert('Помилка', 'Не вдалося видалити шаблон');
            } finally {
              setInvoicesLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenSendConfirm = (id: number, defaultIncludeAct?: boolean) => {
    setTargetInvoiceId(id);
    const today = new Date();
    setCustomSendDay(today.getDate().toString());
    setCustomSendMonth((today.getMonth() + 1).toString());
    setCustomDateEnabled(false);
    
    const rec = recurringInvoices.find(item => item.id === id);
    setSendIncludeAct(defaultIncludeAct !== undefined ? defaultIncludeAct : (rec ? rec.include_act : true));
    
    setSendConfirmVisible(true);
  };

  const handleConfirmSendInvoice = async () => {
    if (!targetInvoiceId || !selectedProfile) return;

    let dayParam: number | undefined = undefined;
    let monthParam: number | undefined = undefined;

    if (customDateEnabled) {
      const parsedDay = parseInt(customSendDay, 10);
      const parsedMonth = parseInt(customSendMonth, 10);

      if (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31) {
        Alert.alert('Помилка', 'День має бути числом від 1 до 31');
        return;
      }
      if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        Alert.alert('Помилка', 'Місяць має бути числом від 1 до 12');
        return;
      }
      dayParam = parsedDay;
      monthParam = parsedMonth;
    }

    setSendConfirmVisible(false);
    setInvoicesLoading(true);
    try {
      await api.sendInvoiceNow(targetInvoiceId, dayParam, monthParam, sendIncludeAct);
      haptics.success();
      Alert.alert('Успіх', 'Рахунок та супутні документи успішно згенеровані та надіслані!');
      fetchInvoicesData(selectedProfile.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося надіслати рахунок');
    } finally {
      setInvoicesLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 8) }]}>
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : profiles.length === 0 ? (
        <View style={styles.center}>
          <Briefcase size={64} color={colors.textMuted} style={styles.emptyIcon} />
          <Text style={[styles.emptyText, { color: colors.text }]}>Немає активних профілів</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Створіть профіль підприємства в розділі "Профілі", щоб отримати доступ до рахунків та актів.
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Profiles scrollable chip selector */}
          <View style={styles.profileSelector}>
            <Text style={[styles.selectorLabel, { color: colors.textMuted }]}>Оберіть підприємство:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              {profiles.map((p) => {
                const isSelected = selectedProfile?.id === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={async () => {
                      setSelectedProfile(p);
                      await AsyncStorage.setItem('SELECTED_PROFILE_ID', p.id.toString());
                      haptics.light();
                      fetchInvoicesData(p.id);
                    }}
                    style={[
                      styles.chip,
                      isSelected ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }
                    ]}
                  >
                    <Text style={[styles.chipText, isSelected ? { color: '#ffffff', fontWeight: 'bold' } : { color: colors.text }]}>
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Segmented Control / Tabs */}
          <View style={styles.segmentedContainer}>
            <Pressable
              style={[
                styles.segment,
                invActiveTab === 'schedules' && { backgroundColor: colors.cardBorder || 'rgba(120, 120, 128, 0.2)' },
              ]}
              onPress={() => {
                setInvActiveTab('schedules');
                setInvoiceFormVisible(false);
                haptics.light();
              }}
            >
              <Text style={[styles.segmentText, { color: colors.text }]} numberOfLines={1}>
                Регулярні (Авто)
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.segment,
                invActiveTab === 'oneoff' && { backgroundColor: colors.cardBorder || 'rgba(120, 120, 128, 0.2)' },
              ]}
              onPress={() => {
                setInvActiveTab('oneoff');
                setInvoiceFormVisible(false);
                haptics.light();
              }}
            >
              <Text style={[styles.segmentText, { color: colors.text }]} numberOfLines={1}>
                Разовий рахунок
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.segment,
                invActiveTab === 'history' && { backgroundColor: colors.cardBorder || 'rgba(120, 120, 128, 0.2)' },
              ]}
              onPress={() => {
                setInvActiveTab('history');
                setInvoiceFormVisible(false);
                haptics.light();
              }}
            >
              <Text style={[styles.segmentText, { color: colors.text }]} numberOfLines={1}>
                Історія / Архів
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            {invActiveTab === 'schedules' && (
              invoiceFormVisible ? (
                /* Add Recurring Invoice Form */
                <Card style={styles.formCard}>
                  <Text style={[styles.formTitle, { color: colors.text }]}>Новий регулярний рахунок</Text>
                  
                  <Input
                    label="Назва або ПІБ клієнта"
                    placeholder="Наприклад: ТОВ 'Енерджі' або Петренко І.І."
                    value={invClientName}
                    onChangeText={setInvClientName}
                  />

                  <Input
                    label="ЄДРПОУ / ІПН клієнта"
                    placeholder="8 або 10 цифр"
                    value={invClientTaxId}
                    onChangeText={(val) => setInvClientTaxId(val.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                  />

                  <Input
                    label="Юридична адреса клієнта"
                    placeholder="Наприклад: вул. Садова, 5, м. Київ"
                    value={invClientAddress}
                    onChangeText={setInvClientAddress}
                  />

                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Тип операції</Text>
                  <View style={styles.row}>
                    <Pressable
                      style={[
                        styles.halfBtn,
                        invDocumentType === 'act' ? { backgroundColor: colors.primaryMuted, borderColor: colors.primary, borderWidth: 1 } : { backgroundColor: colors.cardBorder + '30', borderWidth: 1, borderColor: colors.border }
                      ]}
                      onPress={() => setInvDocumentType('act')}
                    >
                      <Text style={[styles.btnText, invDocumentType === 'act' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                        Послуга (Акт)
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.halfBtn,
                        invDocumentType === 'waybill' ? { backgroundColor: colors.primaryMuted, borderColor: colors.primary, borderWidth: 1 } : { backgroundColor: colors.cardBorder + '30', borderWidth: 1, borderColor: colors.border }
                      ]}
                      onPress={() => setInvDocumentType('waybill')}
                    >
                      <Text style={[styles.btnText, invDocumentType === 'waybill' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                        Товар (Накладна)
                      </Text>
                    </Pressable>
                  </View>

                  <Input
                    label="Email клієнта (для надсилання) *"
                    placeholder="client@email.com"
                    value={invClientEmail}
                    onChangeText={setInvClientEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Input
                    label="Telegram ID клієнта (опціонально)"
                    placeholder="Наприклад: 123456789"
                    value={invClientTg}
                    onChangeText={setInvClientTg}
                    keyboardType="number-pad"
                  />

                  <Input
                    label="Сума рахунку (грн) *"
                    placeholder="Сума в грн"
                    value={invAmount}
                    onChangeText={setInvAmount}
                    keyboardType="decimal-pad"
                  />

                  <Input
                    label="Опис послуги / Назва товару *"
                    placeholder="За що виставляється рахунок"
                    value={invServiceName}
                    onChangeText={setInvServiceName}
                  />

                  <View style={styles.switchRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.switchTitle, { color: colors.text }]}>
                        {invDocumentType === 'act' ? 'Супутній Акт виконаних робіт' : 'Супутня видаткова накладна'}
                      </Text>
                      <Text style={[styles.switchDesc, { color: colors.textMuted }]}>
                        Автоматично створювати та надсилати документ разом із рахунком
                      </Text>
                    </View>
                    <Switch
                      value={invIncludeAct}
                      onValueChange={setInvIncludeAct}
                      trackColor={{ false: '#767577', true: colors.primary }}
                      thumbColor={invIncludeAct ? '#ffffff' : '#f4f3f4'}
                    />
                  </View>

                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Періодичність</Text>
                  <View style={styles.row}>
                    <Pressable
                      style={[
                        styles.halfBtn,
                        invPeriodicity === 'monthly' ? { backgroundColor: colors.primaryMuted, borderColor: colors.primary, borderWidth: 1 } : { backgroundColor: colors.cardBorder + '30', borderWidth: 1, borderColor: colors.border }
                      ]}
                      onPress={() => {
                        setInvPeriodicity('monthly');
                        setInvSendMonth(null);
                      }}
                    >
                      <Text style={[styles.btnText, invPeriodicity === 'monthly' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                        Щомісячно
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.halfBtn,
                        invPeriodicity === 'specific' ? { backgroundColor: colors.primaryMuted, borderColor: colors.primary, borderWidth: 1 } : { backgroundColor: colors.cardBorder + '30', borderWidth: 1, borderColor: colors.border }
                      ]}
                      onPress={() => {
                        setInvPeriodicity('specific');
                        setInvSendMonth(new Date().getMonth() + 1);
                      }}
                    >
                      <Text style={[styles.btnText, invPeriodicity === 'specific' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                        Один раз на рік
                      </Text>
                    </Pressable>
                  </View>

                  {invPeriodicity === 'specific' && (
                    <Input
                      label="Місяць відправки (1-12) *"
                      placeholder="12 (Грудень)"
                      value={invSendMonth ? invSendMonth.toString() : ''}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        if (isNaN(parsed)) {
                          setInvSendMonth(null);
                        } else {
                          setInvSendMonth(Math.max(1, Math.min(12, parsed)));
                        }
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  )}

                  <Input
                    label="Число відправки щомісяця (1-28) *"
                    placeholder="1"
                    value={invSendDay}
                    onChangeText={setInvSendDay}
                    keyboardType="number-pad"
                    maxLength={2}
                  />

                  <View style={[styles.row, { marginTop: 16 }]}>
                    <Button
                      title="Скасувати"
                      onPress={() => setInvoiceFormVisible(false)}
                      variant="outline"
                      style={styles.halfBtn}
                    />
                    <Button
                      title="Створити"
                      onPress={handleSaveRecurringInvoice}
                      isLoading={invoicesLoading}
                      style={styles.halfBtn}
                    />
                  </View>
                </Card>
              ) : (
                /* Schedules list */
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Шаблони авто-надсилання</Text>
                    <Button
                      title="Додати шаблон"
                      onPress={() => setInvoiceFormVisible(true)}
                      style={styles.headerBtn}
                      textStyle={{ fontSize: 13 }}
                    />
                  </View>

                  {invoicesLoading && recurringInvoices.length === 0 ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
                  ) : recurringInvoices.length === 0 ? (
                    <Card style={styles.emptyCardContainer}>
                      <Calendar size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
                      <Text style={[styles.emptyTextSmall, { color: colors.text }]}>
                        Немає активних авто-надсилань
                      </Text>
                      <Text style={[styles.emptySubSmall, { color: colors.textMuted }]}>
                        Створіть шаблон, і система автоматично генеруватиме та надсилатиме рахунки клієнтам обраного числа щомісяця.
                      </Text>
                    </Card>
                  ) : (
                    recurringInvoices.map((item) => (
                      <Card key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                          <Text style={[styles.itemNameText, { color: colors.text }]} numberOfLines={1}>
                            {item.service_name}
                          </Text>
                          <Text style={[styles.itemDetailsText, { color: colors.textMuted }]} numberOfLines={1}>
                            Кому: {item.client_email}
                          </Text>
                          <View style={styles.itemMetaRow}>
                            <View style={styles.metaBadge}>
                              <Coins size={12} color={colors.success} style={{ marginRight: 4 }} />
                              <Text style={[styles.metaSalaryText, { color: colors.success }]}>
                                {item.amount.toLocaleString('uk-UA')} ₴
                              </Text>
                            </View>
                            <View style={styles.metaBadge}>
                              <Calendar size={12} color={colors.primary} style={{ marginRight: 4 }} />
                              <Text style={{ fontSize: 11, color: colors.text, fontWeight: '500' }}>
                                {item.send_month ? `${item.send_month}-го міс, ` : ''}{item.send_day}-го числа
                              </Text>
                            </View>
                          </View>
                        </View>
                        
                        <View style={styles.itemActions}>
                          <Pressable
                            onPress={() => handleOpenSendConfirm(item.id, false)}
                            style={[styles.actionBtn, { backgroundColor: colors.primaryMuted }]}
                          >
                            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Рахунок</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleOpenSendConfirm(item.id, true)}
                            style={[styles.actionBtn, { backgroundColor: colors.successMuted, marginLeft: 8 }]}
                          >
                            <Text style={[styles.actionBtnText, { color: colors.success }]}>Рахунок + Акт</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteRecurringInvoice(item.id)}
                            style={[styles.deleteBtn, { backgroundColor: colors.errorMuted, marginLeft: 8 }]}
                          >
                            <Trash2 size={16} color={colors.error} />
                          </Pressable>
                        </View>
                      </Card>
                    ))
                  )}
                </View>
              )
            )}

            {invActiveTab === 'oneoff' && (
              /* One-off Invoice Form */
              <Card style={styles.formCard}>
                <Text style={[styles.formTitle, { color: colors.text }]}>Разовий рахунок</Text>
                <Text style={[styles.formSub, { color: colors.textMuted }]}>
                  Сформувати та відправити рахунок негайно без створення регулярного розкладу.
                </Text>

                <Input
                  label="Назва або ПІБ клієнта"
                  placeholder="Наприклад: ТОВ 'Вектор' або ФОП Коваль"
                  value={oneoffClientName}
                  onChangeText={setOneoffClientName}
                />

                <Input
                  label="ЄДРПОУ / ІПН клієнта"
                  placeholder="8 або 10 цифр"
                  value={oneoffClientTaxId}
                  onChangeText={(val) => setOneoffClientTaxId(val.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                />

                <Input
                  label="Юридична адреса клієнта"
                  placeholder="Наприклад: вул. Зелена, 12, м. Львів"
                  value={oneoffClientAddress}
                  onChangeText={setOneoffClientAddress}
                />

                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Тип операції</Text>
                <View style={styles.row}>
                  <Pressable
                    style={[
                      styles.halfBtn,
                      oneoffDocumentType === 'act' ? { backgroundColor: colors.primaryMuted, borderColor: colors.primary, borderWidth: 1 } : { backgroundColor: colors.cardBorder + '30', borderWidth: 1, borderColor: colors.border }
                    ]}
                    onPress={() => setOneoffDocumentType('act')}
                  >
                    <Text style={[styles.btnText, oneoffDocumentType === 'act' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                      Послуга (Акт)
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.halfBtn,
                      oneoffDocumentType === 'waybill' ? { backgroundColor: colors.primaryMuted, borderColor: colors.primary, borderWidth: 1 } : { backgroundColor: colors.cardBorder + '30', borderWidth: 1, borderColor: colors.border }
                    ]}
                    onPress={() => setOneoffDocumentType('waybill')}
                  >
                    <Text style={[styles.btnText, oneoffDocumentType === 'waybill' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                      Товар (Накладна)
                    </Text>
                  </Pressable>
                </View>

                <Input
                  label="Email клієнта (для надсилання) *"
                  placeholder="client@email.com"
                  value={oneoffClientEmail}
                  onChangeText={setOneoffClientEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Input
                  label="Telegram ID клієнта (опціонально)"
                  placeholder="Наприклад: 123456789"
                  value={oneoffClientTg}
                  onChangeText={setOneoffClientTg}
                  keyboardType="number-pad"
                />

                <Input
                  label="Сума рахунку (грн) *"
                  placeholder="Сума в грн"
                  value={oneoffAmount}
                  onChangeText={setOneoffAmount}
                  keyboardType="decimal-pad"
                />

                <Input
                  label="Опис послуги / Назва товару *"
                  placeholder="Наприклад: Надання ІТ послуг за Договором"
                  value={oneoffServiceName}
                  onChangeText={setOneoffServiceName}
                />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.switchTitle, { color: colors.text }]}>
                      {oneoffDocumentType === 'act' ? 'Супутній Акт виконаних робіт' : 'Супутня видаткова накладна'}
                    </Text>
                    <Text style={[styles.switchDesc, { color: colors.textMuted }]}>
                      Автоматично створити та надіслати документ разом із рахунком
                    </Text>
                  </View>
                  <Switch
                    value={oneoffIncludeAct}
                    onValueChange={setOneoffIncludeAct}
                    trackColor={{ false: '#767577', true: colors.primary }}
                    thumbColor={oneoffIncludeAct ? '#ffffff' : '#f4f3f4'}
                  />
                </View>

                <Button
                  title="Надіслати негайно"
                  onPress={handleSendOneoffInvoice}
                  isLoading={invoicesLoading}
                  style={{ marginTop: 16 }}
                />
              </Card>
            )}

            {invActiveTab === 'history' && (
              /* Invoices & Acts history list */
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
                  Архів виставлених рахунків ({invoicesHistory.length})
                </Text>

                {invoicesLoading && invoicesHistory.length === 0 ? (
                  <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
                ) : invoicesHistory.length === 0 ? (
                  <Card style={styles.emptyCardContainer}>
                    <FileText size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
                    <Text style={[styles.emptyTextSmall, { color: colors.text }]}>
                      Історія рахунків порожня
                    </Text>
                    <Text style={[styles.emptySubSmall, { color: colors.textMuted }]}>
                      Тут зберігатимуться всі автоматично або вручну надіслані рахунки та супутні документи.
                    </Text>
                  </Card>
                ) : (
                  invoicesHistory.map((item) => (
                    <Card key={item.id} style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <Text style={[styles.historyNumber, { color: colors.text }]}>
                          Рахунок {item.invoice_number}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          {item.send_date}
                        </Text>
                      </View>

                      <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500', marginVertical: 4 }}>
                        {item.service_name}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>
                        Клієнт: {item.client_email}
                      </Text>

                      <View style={styles.historyMetaRow}>
                        <View style={styles.metaBadge}>
                          <Coins size={12} color={colors.success} style={{ marginRight: 4 }} />
                          <Text style={[styles.metaSalaryText, { color: colors.success, fontSize: 12 }]}>
                            {item.amount.toLocaleString('uk-UA')} ₴
                          </Text>
                        </View>

                        {item.act ? (
                          <View style={styles.metaBadge}>
                            <CheckCircle2 size={12} color={colors.success} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, color: colors.success, fontWeight: '600' }}>
                              {item.document_type === 'waybill' ? 'Накладна' : 'Акт'} №{item.act.act_number}
                            </Text>
                          </View>
                        ) : (
                          <Text style={{ fontSize: 11, color: colors.textMuted }}>
                            Без акту/накладної
                          </Text>
                        )}
                      </View>

                      <View style={styles.historyActions}>
                        <Pressable
                          onPress={() => handleDownloadInvoicePdf(item.id)}
                          style={[styles.historyBtn, { backgroundColor: colors.primaryMuted, borderColor: colors.primary + '33' }]}
                        >
                          <Text style={[styles.historyBtnText, { color: colors.primary }]}>Рахунок PDF</Text>
                        </Pressable>

                        {item.act ? (
                          <Pressable
                            onPress={() => handleDownloadDocumentPdf(item.id)}
                            style={[styles.historyBtn, { backgroundColor: colors.successMuted, borderColor: colors.success + '33' }]}
                          >
                            <Text style={[styles.historyBtnText, { color: colors.success }]}>
                              {item.document_type === 'waybill' ? 'Накладна PDF' : 'Акт PDF'}
                            </Text>
                          </Pressable>
                        ) : (
                          <>
                            <Pressable
                              onPress={() => handleCreateInvoiceDocument(item.id, 'act')}
                              style={[styles.historyBtn, { backgroundColor: colors.cardBorder + '30', borderColor: colors.border }]}
                            >
                              <Text style={[styles.historyBtnText, { color: colors.text }]}>+ Акт</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => handleCreateInvoiceDocument(item.id, 'waybill')}
                              style={[styles.historyBtn, { backgroundColor: colors.cardBorder + '30', borderColor: colors.border }]}
                            >
                              <Text style={[styles.historyBtnText, { color: colors.text }]}>+ Накладну</Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    </Card>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Manual Send Confirmation Modal */}
      {sendConfirmVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Підтвердження відправки</Text>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Надіслати рахунок для обраного регулярного розкладу зараз на email клієнта?
            </Text>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.switchTitle, { color: colors.text, fontSize: 13 }]}>Включити Акт виконаних робіт / Накладну</Text>
              </View>
              <Switch
                value={sendIncludeAct}
                onValueChange={setSendIncludeAct}
                trackColor={{ false: '#767577', true: colors.primary }}
                thumbColor={sendIncludeAct ? '#ffffff' : '#f4f3f4'}
              />
            </View>

            <View style={[styles.row, { marginTop: 16 }]}>
              <Button
                title="Скасувати"
                onPress={() => setSendConfirmVisible(false)}
                variant="outline"
                style={styles.halfBtn}
              />
              <Button
                title="Надіслати"
                onPress={handleConfirmSendInvoice}
                style={styles.halfBtn}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  profileSelector: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(120, 120, 128, 0.12)',
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 12,
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: 'rgba(120, 120, 128, 0.1)',
    margin: 16,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  formCard: {
    padding: 16,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  formSub: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  halfBtn: {
    flex: 1,
  },
  btnText: {
    fontSize: 12,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 8,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  switchDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emptyCardContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTextSmall: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubSmall: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  itemCard: {
    padding: 14,
    marginBottom: 8,
  },
  itemInfo: {
    marginBottom: 10,
  },
  itemNameText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemDetailsText: {
    fontSize: 12,
    marginBottom: 6,
  },
  itemMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(120, 120, 128, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaSalaryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(120, 120, 128, 0.12)',
    paddingTop: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCard: {
    padding: 14,
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(120, 120, 128, 0.12)',
    marginBottom: 10,
  },
  historyActions: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  historyBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  historyBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  modalContent: {
    width: '90%',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
