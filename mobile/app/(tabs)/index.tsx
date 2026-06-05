import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { api, ProfileData } from '../../services/api';
import { haptics } from '../../services/haptics';
import { router } from 'expo-router';
import {
  ChevronDown,
  Calendar,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Briefcase,
  PlusCircle,
  FileText,
  Upload,
  MessageSquare,
  Send,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const { telegramId } = useAuth();

  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [activeMobileModal, setActiveMobileModal] = useState<'income' | 'tax_due' | 'tax_paid' | 'debt' | null>(null);

  const isFop = selectedProfile?.type === 'fop' || dashboardData?.type === 'fop' || String(selectedProfile?.tax_system || '').includes('fop') || String(dashboardData?.tax_system || '').includes('fop') || selectedProfile?.tax_system === 'ednuy-3-5%' || dashboardData?.tax_system === 'ednuy-3-5%';
  const isSimplified = selectedProfile?.tax_system === 'ednuy-3-5%' || dashboardData?.tax_system === 'ednuy-3-5%';

  // AI Chat States
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string }>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Period Selector States
  const [periodType, setPeriodType] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonthValue, setSelectedMonthValue] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    if (!telegramId) return;
    setLoading(true);
    try {
      const profileList = await api.getProfiles(telegramId);
      setProfiles(profileList);

      if (profileList.length > 0) {
        // Load previously selected profile if exists
        const storedProfileId = await AsyncStorage.getItem('SELECTED_PROFILE_ID');
        const match = profileList.find((p) => p.id.toString() === storedProfileId);
        const activeProfile = match || profileList[0];
        setSelectedProfile(activeProfile);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити дані');
      setLoading(false);
    }
  };

  const fetchDashboard = async (profileId: number, type = periodType, yr = selectedYear, val = (type === 'month' ? selectedMonthValue : selectedQuarter)) => {
    try {
      const data = await api.getDashboard(
        profileId,
        type,
        type !== 'all' ? yr : undefined,
        type === 'month' ? val : (type === 'quarter' ? val : undefined)
      );
      setDashboardData(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити показники дашборду');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedProfile) {
      fetchDashboard(
        selectedProfile.id,
        periodType,
        selectedYear,
        periodType === 'month' ? selectedMonthValue : selectedQuarter
      );
    }
  }, [selectedProfile?.id, periodType, selectedYear, selectedMonthValue, selectedQuarter]);

  useEffect(() => {
    if (selectedProfile) {
      setChatMessages([
        {
          sender: 'agent',
          text: `Вітаю! Я ваш персональний ШІ-Асистент UniTax для профілю **${selectedProfile.name}**. Я знаю все про ваші податки, доходи, працівників та військовий збір. Запитайте мене про будь-що!`,
        },
      ]);
    }
  }, [selectedProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedProfile) {
      await fetchDashboard(selectedProfile.id);
    } else {
      await loadInitialData();
    }
  };

  const handleSelectProfile = async (profile: ProfileData) => {
    setSelectedProfile(profile);
    setProfileModalVisible(false);
    setLoading(true);
    await AsyncStorage.setItem('SELECTED_PROFILE_ID', profile.id.toString());
  };

  const handleSendChatMessage = async () => {
    if (!inputMessage.trim() || sendingChat || !selectedProfile) return;

    const userMsg = inputMessage.trim();
    setInputMessage('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setSendingChat(true);

    try {
      const res = await api.agentChat(selectedProfile.id, userMsg);
      setChatMessages((prev) => [...prev, { sender: 'agent', text: res.response }]);
    } catch (e) {
      console.error(e);
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: "Вибачте, виникла помилка з'єднання з ШІ-агентом. Спробуйте пізніше.",
        },
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  const handleMarkEventPaid = (eventId: number, eventTitle: string) => {
    Alert.alert(
      'Підтвердження сплати',
      `Позначити подію "${eventTitle}" як виконану?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Так, сплачено',
          onPress: async () => {
            try {
              await api.payCalendarEvent(eventId);
              haptics.success();
              Alert.alert('Успіх', 'Подію позначено як сплачену');
              if (selectedProfile) {
                fetchDashboard(selectedProfile.id);
              }
            } catch (e) {
              console.error(e);
              Alert.alert('Помилка', 'Не вдалося оновити статус події');
            }
          },
        },
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (profiles.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Briefcase size={64} color={colors.textMuted} style={styles.emptyIcon} />
        <Text style={[styles.emptyText, { color: colors.text }]}>Немає активних профілів</Text>
        <Text style={[styles.emptySub, { color: colors.textMuted }]}>
          Для перегляду аналітики та сплати податків необхідно створити профіль ФОП або ТОВ.
        </Text>
        <Button
          title="Створити профіль"
          onPress={() => router.push('/profiles')}
          style={styles.emptyBtn}
        />
      </View>
    );
  }

  // Calculate total taxes due
  const totalTaxesDue =
    (dashboardData?.tax_due || 0) +
    (dashboardData?.military_tax_due || 0) +
    (dashboardData?.esv_due || 0) +
    (dashboardData?.pit_due || 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Profile Switcher Header */}
      <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
        <Pressable
          style={[styles.profileSelector, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
          onPress={() => setProfileModalVisible(true)}
        >
          <Briefcase size={16} color={colors.primary} style={styles.profileSelectIcon} />
          <Text style={[styles.profileSelectText, { color: colors.text }]} numberOfLines={1}>
            {selectedProfile?.name}
          </Text>
          <ChevronDown size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Period Selector Toggle */}
        <View style={[styles.periodSelectorContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
            {[
              { id: 'all', label: 'За весь час' },
              { id: 'month', label: 'Місяць' },
              { id: 'quarter', label: 'Квартал' },
              { id: 'year', label: 'Рік' }
            ].map((p) => {
              const active = periodType === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPeriodType(p.id)}
                  style={[
                    styles.periodTab,
                    active && { backgroundColor: colors.primary }
                  ]}
                >
                  <Text style={[styles.periodTabText, active && { color: '#ffffff' }, { color: colors.text }]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Secondary Period Details (Month/Quarter/Year Selectors) */}
        {periodType === 'month' && (
          <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8, alignItems: 'center' }}>
            {/* Year selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[2025, 2026].map((yr) => (
                <Pressable
                  key={yr}
                  onPress={() => setSelectedYear(yr)}
                  style={[
                    styles.subPeriodBtn,
                    selectedYear === yr && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
                  ]}
                >
                  <Text style={[styles.subPeriodBtnText, { color: colors.text }]}>{yr}</Text>
                </Pressable>
              ))}
            </ScrollView>
            
            <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />
            
            {/* Month selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setSelectedMonthValue(m)}
                  style={[
                    styles.subPeriodBtn,
                    selectedMonthValue === m && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
                  ]}
                >
                  <Text style={[styles.subPeriodBtnText, { color: colors.text }]}>
                    {new Date(2020, m - 1, 1).toLocaleString('uk-UA', { month: 'short' })}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {periodType === 'quarter' && (
          <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8, alignItems: 'center' }}>
            {/* Year selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[2025, 2026].map((yr) => (
                <Pressable
                  key={yr}
                  onPress={() => setSelectedYear(yr)}
                  style={[
                    styles.subPeriodBtn,
                    selectedYear === yr && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
                  ]}
                >
                  <Text style={[styles.subPeriodBtnText, { color: colors.text }]}>{yr}</Text>
                </Pressable>
              ))}
            </ScrollView>
            
            <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

            {/* Quarter selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[1, 2, 3, 4].map((q) => (
                <Pressable
                  key={q}
                  onPress={() => setSelectedQuarter(q)}
                  style={[
                    styles.subPeriodBtn,
                    selectedQuarter === q && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
                  ]}
                >
                  <Text style={[styles.subPeriodBtnText, { color: colors.text }]}>Q{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {periodType === 'year' && (
          <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8, alignItems: 'center' }}>
            {/* Year selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[2025, 2026].map((yr) => (
                <Pressable
                  key={yr}
                  onPress={() => setSelectedYear(yr)}
                  style={[
                    styles.subPeriodBtn,
                    selectedYear === yr && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
                  ]}
                >
                  <Text style={[styles.subPeriodBtnText, { color: colors.text }]}>{yr} рік</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Main Metrics Cards */}
        <View style={styles.metricsGrid}>
          <Pressable style={styles.metricCardPressable} onPress={() => { haptics.light(); setActiveMobileModal('income'); }}>
            <Card style={styles.metricCardInner}>
              <TrendingUp size={20} color={colors.primary} style={styles.metricIcon} />
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Оподатковуваний дохід</Text>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {dashboardData?.taxable_income?.toLocaleString('uk-UA')} ₴
              </Text>
            </Card>
          </Pressable>

          <Pressable style={styles.metricCardPressable} onPress={() => { haptics.light(); setActiveMobileModal('tax_due'); }}>
            <Card style={styles.metricCardInner}>
              <AlertCircle size={20} color={colors.warning} style={styles.metricIcon} />
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Нараховано податків</Text>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {totalTaxesDue?.toLocaleString('uk-UA')} ₴
              </Text>
            </Card>
          </Pressable>
        </View>

        <View style={styles.metricsGrid}>
          <Pressable style={styles.metricCardPressable} onPress={() => { haptics.light(); setActiveMobileModal('tax_paid'); }}>
            <Card style={styles.metricCardInner}>
              <CheckCircle2 size={20} color={colors.success} style={styles.metricIcon} />
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Сплачено податків</Text>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {dashboardData?.tax_paid?.toLocaleString('uk-UA')} ₴
              </Text>
            </Card>
          </Pressable>

          <Pressable
            style={styles.metricCardPressable}
            onPress={() => { haptics.light(); setActiveMobileModal('debt'); }}
          >
            <Card
              style={[
                styles.metricCardInner,
                {
                  borderColor:
                    dashboardData?.difference > 0 ? colors.error : colors.success,
                  borderWidth: 1,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      dashboardData?.difference > 0 ? colors.error : colors.success,
                  },
                ]}
              />
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                {dashboardData?.difference > 0 ? 'Заборгованість' : 'Різниця до сплати'}
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: dashboardData?.difference > 0 ? colors.error : colors.success },
                ]}
              >
                {dashboardData?.difference?.toLocaleString('uk-UA')} ₴
              </Text>
            </Card>
          </Pressable>
        </View>

        {/* Detailed Tax Breakdown */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Деталі податків</Text>
        <Card style={styles.breakdownCard}>
          {/* Row 1: Unified Tax / Corporate Profit Tax */}
          <View style={styles.breakdownRow}>
            <View>
              <Text style={[styles.breakdownName, { color: colors.text }]}>
                {selectedProfile?.type === 'fop' ? 'Єдиний податок' : 'Податок на прибуток'}
              </Text>
              <Text style={[styles.breakdownDetail, { color: colors.textMuted }]}>
                Нараховано: {dashboardData?.tax_due?.toLocaleString('uk-UA')} ₴
              </Text>
            </View>
            <View style={styles.breakdownRight}>
              <Text style={[styles.breakdownPaid, { color: colors.success }]}>
                Спл: {dashboardData?.ep_paid?.toLocaleString('uk-UA')} ₴
              </Text>
              <Text
                style={[
                  styles.breakdownDiff,
                  { color: dashboardData?.ep_diff > 0 ? colors.error : colors.textMuted },
                ]}
              >
                Різн: {dashboardData?.ep_diff?.toLocaleString('uk-UA')} ₴
              </Text>
            </View>
          </View>

          <View style={[styles.line, { backgroundColor: colors.border }]} />

          {/* Row 2: Military Tax (Own + Employee combined) */}
          <View style={styles.breakdownRow}>
            <View>
              <Text style={[styles.breakdownName, { color: colors.text }]}>
                Військовий збір {(dashboardData?.employee_mil_due > 0) ? '(ФОП + зарплати)' : ''}
              </Text>
              <Text style={[styles.breakdownDetail, { color: colors.textMuted }]}>
                Нараховано: {dashboardData?.military_tax_due?.toLocaleString('uk-UA')} ₴
              </Text>
            </View>
            <View style={styles.breakdownRight}>
              <Text style={[styles.breakdownPaid, { color: colors.success }]}>
                Спл: {dashboardData?.mil_paid?.toLocaleString('uk-UA')} ₴
              </Text>
              <Text
                style={[
                  styles.breakdownDiff,
                  { color: dashboardData?.mil_diff > 0 ? colors.error : colors.textMuted },
                ]}
              >
                Різн: {dashboardData?.mil_diff?.toLocaleString('uk-UA')} ₴
              </Text>
            </View>
          </View>

          {/* Row 3: ESV for FOP */}
          {selectedProfile?.type === 'fop' && (
            <>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
              <View style={styles.breakdownRow}>
                <View>
                  <Text style={[styles.breakdownName, { color: colors.text }]}>ЄСВ за себе</Text>
                  <Text style={[styles.breakdownDetail, { color: colors.textMuted }]}>
                    Нараховано: {Math.max(0, (dashboardData?.esv_due || 0) - (dashboardData?.employee_esv_due || 0))?.toLocaleString('uk-UA')} ₴
                  </Text>
                </View>
                <View style={styles.breakdownRight}>
                  <Text style={[styles.breakdownPaid, { color: colors.success }]}>
                    Спл: {Math.max(0, (dashboardData?.esv_paid || 0) - (dashboardData?.employee_esv_due || 0))?.toLocaleString('uk-UA')} ₴
                  </Text>
                  <Text
                    style={[
                      styles.breakdownDiff,
                      { color: dashboardData?.esv_diff > 0 ? colors.error : colors.textMuted },
                    ]}
                  >
                    Різн: {Math.max(0, (dashboardData?.esv_diff || 0) - (dashboardData?.employee_esv_due || 0))?.toLocaleString('uk-UA')} ₴
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Row 4: PIT for Employees */}
          {((dashboardData?.employee_pit_due || 0) > 0) && (
            <>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
              <View style={styles.breakdownRow}>
                <View>
                  <Text style={[styles.breakdownName, { color: colors.text }]}>ПДФО за працівників (18%)</Text>
                  <Text style={[styles.breakdownDetail, { color: colors.textMuted }]}>
                    Нараховано: {dashboardData?.employee_pit_due?.toLocaleString('uk-UA')} ₴
                  </Text>
                </View>
                <View style={styles.breakdownRight}>
                  <Text style={[styles.breakdownPaid, { color: colors.success }]}>
                    Спл: {dashboardData?.pit_paid?.toLocaleString('uk-UA')} ₴
                  </Text>
                  <Text
                    style={[
                      styles.breakdownDiff,
                      { color: dashboardData?.pit_diff > 0 ? colors.error : colors.textMuted },
                    ]}
                  >
                    Різн: {dashboardData?.pit_diff?.toLocaleString('uk-UA')} ₴
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Row 5: ESV for Employees */}
          {((dashboardData?.employee_esv_due || 0) > 0) && (
            <>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
              <View style={styles.breakdownRow}>
                <View>
                  <Text style={[styles.breakdownName, { color: colors.text }]}>ЄСВ за працівників (22%)</Text>
                  <Text style={[styles.breakdownDetail, { color: colors.textMuted }]}>
                    Нараховано: {dashboardData?.employee_esv_due?.toLocaleString('uk-UA')} ₴
                  </Text>
                </View>
                <View style={styles.breakdownRight}>
                  <Text style={[styles.breakdownPaid, { color: colors.success }]}>
                    Спл: {dashboardData?.employee_esv_due?.toLocaleString('uk-UA')} ₴
                  </Text>
                  <Text
                    style={[
                      styles.breakdownDiff,
                      { color: colors.textMuted },
                    ]}
                  >
                    Різн: 0 ₴
                  </Text>
                </View>
              </View>
            </>
          )}
        </Card>

        {/* Upcoming Calendar Events */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Податковий календар</Text>
        {(!dashboardData?.upcoming_events || dashboardData.upcoming_events.length === 0) ? (
          <Card style={styles.emptyCalendar}>
            <Calendar size={24} color={colors.textMuted} style={styles.emptyCalendarIcon} />
            <Text style={[styles.emptyCalendarText, { color: colors.textMuted }]}>
              Немає найближчих подій у календарі
            </Text>
          </Card>
        ) : (
          dashboardData.upcoming_events.map((event: any) => (
            <Card key={event.id} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <View style={styles.eventTitleContainer}>
                  <Calendar size={16} color={colors.primary} style={styles.calendarIcon} />
                  <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                    {event.title}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        event.status === 'paid' ? colors.successMuted : colors.warningMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: event.status === 'paid' ? colors.success : colors.warning },
                    ]}
                  >
                    {event.status === 'paid' ? 'Сплачено' : 'Очікує'}
                  </Text>
                </View>
              </View>

              <View style={styles.eventBody}>
                <Text style={[styles.eventDate, { color: colors.textMuted }]}>
                  Дедлайн: {event.due_date}
                </Text>
                <Text style={[styles.eventDesc, { color: colors.textMuted }]}>
                  Сума: {event.amount_desc}
                </Text>
              </View>

              {event.status !== 'paid' && (
                <Button
                  title="Позначити як сплачено"
                  onPress={() => handleMarkEventPaid(event.id, event.title)}
                  variant="secondary"
                  style={styles.eventBtn}
                  textStyle={{ fontSize: 13 }}
                />
              )}
            </Card>
          ))
        )}

        {/* Quick Actions Panel */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Швидкі дії</Text>
        <View style={styles.quickActions}>
          <Pressable
            style={[styles.actionBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => router.push('/transactions')}
          >
            <Upload size={24} color={colors.primary} />
            <Text style={[styles.actionBoxText, { color: colors.text }]}>Імпорт виписки</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => router.push('/reports')}
          >
            <FileText size={24} color={colors.primary} />
            <Text style={[styles.actionBoxText, { color: colors.text }]}>Згенерувати звіт</Text>
          </Pressable>
        </View>

        {/* AI Assistant card */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Інтерактивний ШІ-Асистент</Text>
        <Card style={[styles.aiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.aiCardHeader}>
            <MessageSquare size={20} color={colors.primary} style={styles.aiIcon} />
            <Text style={[styles.aiCardTitle, { color: colors.text }]}>ШІ-Асистент UniTax</Text>
          </View>
          <Text style={[styles.aiCardBody, { color: colors.textMuted }]}>
            Запитайте про військовий збір, доходи, ліміти, терміни подачі декларацій чи інші податкові питання.
          </Text>
          <Button
            title="Запустити Чат з ШІ"
            onPress={() => setChatModalVisible(true)}
            variant="primary"
            style={styles.aiCardBtn}
          />
        </Card>
      </ScrollView>

      {/* Profile Selector Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={profileModalVisible}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setProfileModalVisible(false)}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background, borderColor: colors.cardBorder },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Оберіть податковий профіль</Text>
            <FlatList
              data={profiles}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.profileItem,
                    selectedProfile?.id === item.id && { backgroundColor: colors.primaryMuted },
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => handleSelectProfile(item)}
                >
                  <Briefcase
                    size={20}
                    color={selectedProfile?.id === item.id ? colors.primary : colors.textMuted}
                    style={styles.profileItemIcon}
                  />
                  <View>
                    <Text style={[styles.profileItemName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.profileItemCode, { color: colors.textMuted }]}>
                      Код: {item.tax_id} • {item.type === 'fop' ? 'ФОП' : 'Юр. особа'}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
            <Button
              title="Додати новий профіль"
              onPress={() => {
                setProfileModalVisible(false);
                router.push('/profiles');
              }}
              variant="outline"
              style={styles.modalAddBtn}
            />
          </View>
        </Pressable>
      </Modal>

      {/* AI Chat Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={chatModalVisible}
        onRequestClose={() => setChatModalVisible(false)}
      >
        <SafeAreaView style={[styles.chatModalContainer, { backgroundColor: colors.background }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
            <View style={[styles.chatHeader, { borderBottomColor: colors.cardBorder }]}>
              <View style={styles.chatHeaderLeft}>
                <MessageSquare size={24} color={colors.primary} />
                <View style={{ marginLeft: 8 }}>
                  <Text style={[styles.chatHeaderTitle, { color: colors.text }]}>
                    ШІ-Асистент UniTax
                  </Text>
                  <Text style={[styles.chatHeaderSubtitle, { color: colors.textMuted }]}>
                    {selectedProfile ? selectedProfile.name : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setChatModalVisible(false)}
                style={styles.chatCloseBtn}
              >
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Закрити</Text>
              </TouchableOpacity>
            </View>

            {/* Messages List */}
            <FlatList
              data={chatMessages}
              keyExtractor={(_, index) => index.toString()}
              contentContainerStyle={styles.chatMessagesList}
              renderItem={({ item }) => {
                const isAgent = item.sender === 'agent';
                return (
                  <View
                    style={[
                      styles.chatMessageBubbleContainer,
                      isAgent ? styles.chatBubbleLeft : styles.chatBubbleRight,
                    ]}
                  >
                    <View
                      style={[
                        styles.chatMessageBubble,
                        isAgent
                          ? [styles.chatBubbleAgent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]
                          : [styles.chatBubbleUser, { backgroundColor: colors.primary }],
                      ]}
                    >
                      <Text
                        style={[
                          styles.chatMessageText,
                          isAgent ? { color: colors.text } : { color: '#ffffff' },
                        ]}
                      >
                        {item.text}
                      </Text>
                    </View>
                  </View>
                );
              }}
              ListFooterComponent={
                sendingChat ? (
                  <View style={styles.chatTypingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.chatTypingText, { color: colors.textMuted }]}>
                      Аналіз профілю та законів...
                    </Text>
                  </View>
                ) : null
              }
            />

            {/* Message Input Row */}
            <View style={[styles.chatInputContainer, { borderTopColor: colors.cardBorder, backgroundColor: colors.background }]}>
              <TextInput
                value={inputMessage}
                onChangeText={setInputMessage}
                placeholder="Задайте питання про військовий збір, звітність..."
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.chatInput,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    borderColor: colors.cardBorder,
                  },
                ]}
                multiline
              />
              <TouchableOpacity
                onPress={handleSendChatMessage}
                disabled={!inputMessage.trim() || sendingChat}
                style={[
                  styles.chatSendBtn,
                  {
                    backgroundColor: inputMessage.trim() ? colors.primary : colors.inputBg,
                  },
                ]}
              >
                <Send size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Details Modals */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={activeMobileModal !== null}
        onRequestClose={() => setActiveMobileModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActiveMobileModal(null)}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background, borderColor: colors.cardBorder, maxHeight: '70%' },
            ]}
          >
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingBottom: 12 }}>
              <View>
                <Text style={[styles.modalTitleText, { color: colors.text }]}>
                  {activeMobileModal === 'income' && 'Загальний дохід'}
                  {activeMobileModal === 'tax_due' && 'Нараховано податку'}
                  {activeMobileModal === 'tax_paid' && 'Сплачено податків'}
                  {activeMobileModal === 'debt' && 'Різниця / Борг'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.primary, marginTop: 2 }}>Детальний опис та розшифровка</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveMobileModal(null)} style={{ padding: 6 }}>
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>Закрити</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 16 }}>
              {activeMobileModal === 'income' && (
                <View style={styles.mobileModalBody}>
                  <Text style={[styles.mobileModalDescText, { color: colors.text }]}>
                    <Text style={{ fontWeight: '700' }}>Загальний дохід</Text> — це сумарний обсяг коштів, отриманих ФОП на розрахункові рахунки протягом звітного періоду.
                  </Text>
                  
                  <View style={[styles.mobileStatsBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={styles.mobileStatRow}>
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>Поточний дохід:</Text>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                        {dashboardData?.total_income?.toLocaleString('uk-UA')} ₴
                      </Text>
                    </View>
                    
                    {isFop && (
                      <>
                        <View style={styles.mobileStatRow}>
                          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Граничний ліміт доходу:</Text>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                            {((selectedProfile?.group === 1 ? 1444049 : selectedProfile?.group === 2 ? 7211598 : 10091049))?.toLocaleString('uk-UA')} ₴
                          </Text>
                        </View>
                        <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4, textAlign: 'right' }}>
                          Використано {(((dashboardData?.total_income || 0) / (selectedProfile?.group === 1 ? 1444049 : selectedProfile?.group === 2 ? 7211598 : 10091049)) * 100).toFixed(2)}% ліміту
                        </Text>
                      </>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 8, fontStyle: 'italic', lineHeight: 16 }}>
                    * Формується на основі імпортованих виписок. Власні кошти та інші неоподатковувані надходження можна скоригувати у списку транзакцій.
                  </Text>
                </View>
              )}

              {activeMobileModal === 'tax_due' && (
                <View style={styles.mobileModalBody}>
                  <Text style={[styles.mobileModalDescText, { color: colors.text, marginBottom: 12 }]}>
                    <Text style={{ fontWeight: '700' }}>Нараховано податку</Text> — розрахунок усіх податкових зобов'язань за поточний звітний період.
                  </Text>

                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', marginBottom: 6 }}>Податки бізнесу</Text>
                  <View style={[styles.mobileStatsBox, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginBottom: 12 }]}>
                    <View style={styles.mobileStatRow}>
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                        {isSimplified 
                          ? `Єдиний податок (${dashboardData?.rate || selectedProfile?.rate || 5}%):`
                          : isFop 
                            ? `ПДФО від прибутку (18%):` 
                            : 'Податок на прибуток (18%):'}
                      </Text>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                        {(dashboardData?.tax_due || 0).toLocaleString('uk-UA')} ₴
                      </Text>
                    </View>

                    {isFop && (
                      <>
                        <View style={[styles.mobileStatRow, { borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 6, marginTop: 6 }]}>
                          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Військовий збір за себе (1%):</Text>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                            {Math.max(0, (dashboardData?.military_tax_due || 0) - (dashboardData?.employee_mil_due || 0)).toLocaleString('uk-UA')} ₴
                          </Text>
                        </View>
                        <View style={styles.mobileStatRow}>
                          <Text style={{ color: colors.textMuted, fontSize: 13 }}>ЄСВ за себе (ФОП):</Text>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                            {Math.max(0, (dashboardData?.esv_due || 0) - (dashboardData?.employee_esv_due || 0)).toLocaleString('uk-UA')} ₴
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {((dashboardData?.employee_pit_due || 0) > 0 || (dashboardData?.employee_mil_due || 0) > 0 || (dashboardData?.employee_esv_due || 0) > 0) && (
                    <>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', marginBottom: 6 }}>Податки за працівників</Text>
                      <View style={[styles.mobileStatsBox, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginBottom: 12 }]}>
                        <View style={styles.mobileStatRow}>
                          <Text style={{ color: colors.textMuted, fontSize: 13 }}>ПДФО із зарплат (18%):</Text>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                            {(dashboardData?.employee_pit_due || 0).toLocaleString('uk-UA')} ₴
                          </Text>
                        </View>
                        <View style={[styles.mobileStatRow, { borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 6, marginTop: 6 }]}>
                          <Text style={{ color: colors.warning, fontSize: 13, fontWeight: '500' }}>Військовий збір із зарплат (5%):</Text>
                          <Text style={{ color: colors.warning, fontSize: 13, fontWeight: '500' }}>
                            {(dashboardData?.employee_mil_due || 0).toLocaleString('uk-UA')} ₴
                          </Text>
                        </View>
                        <View style={styles.mobileStatRow}>
                          <Text style={{ color: colors.textMuted, fontSize: 13 }}>ЄСВ на зарплату (22%):</Text>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                            {(dashboardData?.employee_esv_due || 0).toLocaleString('uk-UA')} ₴
                          </Text>
                        </View>
                      </View>
                    </>
                  )}

                  <View style={[styles.mobileStatsBox, { backgroundColor: colors.primaryMuted, borderColor: colors.primary, borderWidth: 0.5 }]}>
                    <View style={styles.mobileStatRow}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Всього до сплати:</Text>
                      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
                        {((dashboardData?.tax_due || 0) + (dashboardData?.military_tax_due || 0) + (dashboardData?.esv_due || 0) + (dashboardData?.pit_due || 0)).toLocaleString('uk-UA')} ₴
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {activeMobileModal === 'tax_paid' && (
                <View style={styles.mobileModalBody}>
                  <Text style={[styles.mobileModalDescText, { color: colors.text }]}>
                    <Text style={{ fontWeight: '700' }}>Сплачено податків</Text> — загальна сума сплачених податкових платежів, що були розпізнані в банківських виписках.
                  </Text>

                  <View style={[styles.mobileStatsBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={styles.mobileStatRow}>
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>Сплачено ЄСВ:</Text>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                        {(dashboardData?.tax_breakdown?.esv || 0).toLocaleString('uk-UA')} ₴
                      </Text>
                    </View>
                    <View style={styles.mobileStatRow}>
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>Сплачено Єдиного податку:</Text>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                        {(dashboardData?.tax_breakdown?.unified_tax || 0).toLocaleString('uk-UA')} ₴
                      </Text>
                    </View>
                    {dashboardData?.tax_breakdown?.pit > 0 && (
                      <View style={styles.mobileStatRow}>
                        <Text style={{ color: colors.textMuted, fontSize: 13 }}>Сплачено ПДФО:</Text>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                          {(dashboardData?.tax_breakdown?.pit || 0).toLocaleString('uk-UA')} ₴
                        </Text>
                      </View>
                    )}
                    {dashboardData?.tax_breakdown?.military_tax > 0 && (
                      <View style={styles.mobileStatRow}>
                        <Text style={{ color: colors.textMuted, fontSize: 13 }}>Сплачено Військового збору:</Text>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                          {(dashboardData?.tax_breakdown?.military_tax || 0).toLocaleString('uk-UA')} ₴
                        </Text>
                      </View>
                    )}
                    <View style={[styles.mobileStatRow, { borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 6, marginTop: 6 }]}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Всього сплачено:</Text>
                      <Text style={{ color: colors.success, fontSize: 13, fontWeight: '700' }}>
                        {(dashboardData?.tax_paid || 0).toLocaleString('uk-UA')} ₴
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {activeMobileModal === 'debt' && (
                <View style={styles.mobileModalBody}>
                  <Text style={[styles.mobileModalDescText, { color: colors.text, marginBottom: 12 }]}>
                    <Text style={{ fontWeight: '700' }}>Різниця / Борг</Text> відображає порівняння нарахованих податкових зобов'язань та фактично сплачених сум.
                  </Text>

                  <View style={[styles.mobileStatsBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={styles.mobileStatRow}>
                      <View>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
                          {isSimplified 
                            ? 'Єдиний податок' 
                            : isFop 
                              ? 'ПДФО від прибутку' 
                              : 'Податок на прибуток'}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10 }}>Нарах: {dashboardData?.tax_due} ₴ | Спл: {dashboardData?.ep_paid} ₴</Text>
                      </View>
                      <Text style={{ color: dashboardData?.ep_diff > 0 ? colors.error : colors.success, fontSize: 13, fontWeight: '500' }}>
                        {dashboardData?.ep_diff > 0 ? `+${dashboardData?.ep_diff} ₴` : 'Сплачено'}
                      </Text>
                    </View>

                    <View style={[styles.mobileStatRow, { borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 6, marginTop: 6 }]}>
                      <View>
                        <Text style={{ color: colors.warning, fontSize: 13, fontWeight: '700' }}>Військовий збір</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10 }}>Нарах: {dashboardData?.military_tax_due} ₴ | Спл: {dashboardData?.mil_paid} ₴</Text>
                      </View>
                      <Text style={{ color: dashboardData?.mil_diff > 0 ? colors.error : colors.success, fontSize: 13, fontWeight: '500' }}>
                        {dashboardData?.mil_diff > 0 ? `+${dashboardData?.mil_diff} ₴` : 'Сплачено'}
                      </Text>
                    </View>

                    <View style={[styles.mobileStatRow, { borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 6, marginTop: 6 }]}>
                      <View>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>ЄСВ (ФОП + працівники)</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10 }}>Нарах: {dashboardData?.esv_due} ₴ | Спл: {dashboardData?.esv_paid} ₴</Text>
                      </View>
                      <Text style={{ color: dashboardData?.esv_diff > 0 ? colors.error : colors.success, fontSize: 13, fontWeight: '500' }}>
                        {dashboardData?.esv_diff > 0 ? `+${dashboardData?.esv_diff} ₴` : 'Сплачено'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
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
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  profileSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: '90%',
  },
  profileSelectIcon: {
    marginRight: 8,
  },
  profileSelectText: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
    maxWidth: 200,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
    position: 'relative',
  },
  metricIcon: {
    marginBottom: 8,
  },
  statusDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
    paddingLeft: 4,
  },
  breakdownCard: {
    padding: 16,
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownName: {
    fontSize: 15,
    fontWeight: '700',
  },
  breakdownDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  breakdownRight: {
    alignItems: 'flex-end',
  },
  breakdownPaid: {
    fontSize: 13,
    fontWeight: '600',
  },
  breakdownDiff: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  line: {
    height: 1,
    marginVertical: 4,
  },
  emptyCalendar: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCalendarIcon: {
    marginBottom: 8,
  },
  emptyCalendarText: {
    fontSize: 14,
  },
  eventCard: {
    padding: 16,
    marginBottom: 10,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  calendarIcon: {
    marginRight: 8,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  eventBody: {
    marginBottom: 12,
  },
  eventDate: {
    fontSize: 13,
    marginBottom: 2,
  },
  eventDesc: {
    fontSize: 13,
  },
  eventBtn: {
    minHeight: 34,
    paddingVertical: 6,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionBox: {
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBoxText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderBottomWidth: 1,
  },
  profileItemIcon: {
    marginRight: 12,
  },
  profileItemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  profileItemCode: {
    fontSize: 12,
    marginTop: 2,
  },
  modalAddBtn: {
    marginTop: 16,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    width: 180,
  },
  periodSelectorContainer: {
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 12,
  },
  periodTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginHorizontal: 4,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  subPeriodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subPeriodBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dividerVertical: {
    width: 1,
    height: 24,
    alignSelf: 'center',
    marginHorizontal: 4,
  },
  aiCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiIcon: {
    marginRight: 8,
  },
  aiCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  aiCardBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  aiCardBtn: {
    minHeight: 40,
  },
  chatModalContainer: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  chatHeaderSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  chatCloseBtn: {
    padding: 8,
  },
  chatMessagesList: {
    padding: 16,
    paddingBottom: 32,
  },
  chatMessageBubbleContainer: {
    width: '100%',
    marginVertical: 6,
    flexDirection: 'row',
  },
  chatBubbleLeft: {
    justifyContent: 'flex-start',
  },
  chatBubbleRight: {
    justifyContent: 'flex-end',
  },
  chatMessageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  chatBubbleAgent: {
    borderBottomLeftRadius: 0,
  },
  chatBubbleUser: {
    borderBottomRightRadius: 0,
    borderColor: 'transparent',
  },
  chatMessageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  chatTypingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 6,
  },
  chatTypingText: {
    fontSize: 12,
    marginLeft: 8,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  chatInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    marginRight: 8,
    minHeight: 38,
    maxHeight: 100,
  },
  chatSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardPressable: {
    flex: 1,
    marginHorizontal: 4,
  },
  metricCardInner: {
    padding: 16,
    position: 'relative',
    height: '100%',
    width: '100%',
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '700',
  },
  mobileModalBody: {
    paddingTop: 8,
  },
  mobileModalDescText: {
    fontSize: 13,
    lineHeight: 18,
  },
  mobileStatsBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  mobileStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
});
