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
  Dimensions,
  Linking,
  Clipboard,
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
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const { telegramId, logout } = useAuth();

  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [activeMobileModal, setActiveMobileModal] = useState<'income' | 'tax_due' | 'tax_paid' | 'debt' | 'pay_taxes' | null>(null);

  // States for tax payment flow
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [loadingLiabilities, setLoadingLiabilities] = useState(false);
  const [selectedBank, setSelectedBank] = useState<'privat24' | 'monobank' | 'abank'>('privat24');
  const [selectedRegion, setSelectedRegion] = useState<string>('kyiv');
  const [selectedLiability, setSelectedLiability] = useState<any | null>(null);
  const [generatedPayment, setGeneratedPayment] = useState<any | null>(null);
  const [generatingPayment, setGeneratingPayment] = useState(false);

  const loadLiabilities = async () => {
    if (!selectedProfile) return;
    setLoadingLiabilities(true);
    try {
      const data = await api.getTaxLiabilities(selectedProfile.id);
      setLiabilities(data);
    } catch (err) {
      console.error(err);
      Alert.alert('Помилка', 'Не вдалося завантажити податкові зобов\'язання');
    } finally {
      setLoadingLiabilities(false);
    }
  };

  useEffect(() => {
    if (activeMobileModal === 'pay_taxes' && selectedProfile) {
      loadLiabilities();
      setGeneratedPayment(null);
      setSelectedLiability(null);
    }
  }, [activeMobileModal, selectedProfile?.id]);

  const handleGeneratePayment = async (liability: any) => {
    if (!selectedProfile) return;
    setGeneratingPayment(true);
    try {
      const res = await api.generatePayment({
        profile_id: selectedProfile.id,
        tax_type: liability.tax_type,
        amount: liability.amount,
        period: liability.period,
        bank_code: selectedBank,
        region: selectedRegion
      });
      setGeneratedPayment(res);
      setSelectedLiability(liability);
    } catch (err) {
      console.error(err);
      Alert.alert('Помилка', 'Не вдалося згенерувати платіж');
    } finally {
      setGeneratingPayment(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!generatedPayment) return;
    setLoading(true);
    try {
      await api.confirmPayment(generatedPayment.id);
      haptics.success();
      Alert.alert('Успіх', 'Оплату підтверджено. Статус оновиться після клірингу.');
      setGeneratedPayment(null);
      setSelectedLiability(null);
      loadLiabilities();
      if (selectedProfile) {
        fetchDashboard(selectedProfile.id);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Помилка', 'Не вдалося підтвердити платіж');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBankLink = async () => {
    if (!generatedPayment || !generatedPayment.methods || !generatedPayment.methods[selectedBank]) return;
    const url = generatedPayment.methods[selectedBank].deep_link;
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error(err);
      Alert.alert('Увага', 'Не вдалося відкрити додаток банку. Перевірте, чи встановлено додаток.');
    }
  };

  const handleCopyText = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert('Копіювання', `${label} скопійовано до буферу обміну`);
  };

  const isFop = selectedProfile?.type === 'fop' || dashboardData?.type === 'fop' || String(selectedProfile?.tax_system || '').includes('fop') || String(dashboardData?.tax_system || '').includes('fop');
  const isSimplified = selectedProfile?.tax_system === 'ednuy-3-5%' || selectedProfile?.tax_system === 'single_tax' || dashboardData?.tax_system === 'ednuy-3-5%' || dashboardData?.tax_system === 'single_tax';
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (!telegramId || !telegramId.startsWith('guest_') || !dashboardData?.expires_at) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const expiry = new Date(dashboardData.expires_at).getTime();
      const now = new Date().getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft(null);
        Alert.alert('Сесія завершена', 'Час дії вашої гостьової сесії вичерпано.', [
          { text: 'OK', onPress: () => logout() }
        ]);
      } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [telegramId, dashboardData?.expires_at]);

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
  const [activeTab, setActiveTab] = useState<'events' | 'stats'>('events');

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
    } catch (e: any) {
      console.error(e);
      if (e.response?.data?.detail === 'Session expired' || (e.response?.status === 404 && telegramId?.startsWith('guest_'))) {
        Alert.alert('Сесія завершена', 'Час дії вашої гостьової сесії вичерпано.', [
          { text: 'OK', onPress: () => logout() }
        ]);
      } else {
        Alert.alert('Помилка', 'Не вдалося завантажити показники дашборду');
      }
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

  const BellSvg = ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );

  const getEventPeriod = (title: string) => {
    const months = [
      'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
      'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
    ];
    for (const m of months) {
      if (title.includes(m)) {
        const yearMatch = title.match(/\d{4}/);
        return yearMatch ? `${m} ${yearMatch[0]}` : m;
      }
    }
    const quarterMatch = title.match(/(\d+)\s*квартал/i);
    if (quarterMatch) {
      const yearMatch = title.match(/\d{4}/);
      return yearMatch ? `${quarterMatch[1]} кв. ${yearMatch[0]}` : `${quarterMatch[1]} кв.`;
    }
    return 'Травень 2026';
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
      {isDark ? (
        <LinearGradient
          colors={['#090d16', '#090d16', '#141527']}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}

      {/* Custom Header */}
      <View style={[
        styles.customHeader, 
        { 
          borderBottomColor: colors.cardBorder, 
          paddingTop: Platform.OS === 'ios' ? 50 : 25,
          backgroundColor: isDark ? 'rgba(9, 13, 22, 0.65)' : 'rgba(255, 255, 255, 0.85)'
        }
      ]}>
        <View style={styles.headerRow}>
          <Text style={[styles.logoText, { color: colors.text }]}>UniTax</Text>
          <View style={styles.headerRight}>
            <Pressable
              style={[styles.profileBadge, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              onPress={() => setProfileModalVisible(true)}
            >
              <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {selectedProfile?.name ? selectedProfile.name.charAt(0) : 'U'}
                </Text>
              </View>
              <Text style={[styles.userNameText, { color: colors.text }]} numberOfLines={1}>
                {selectedProfile?.name ? selectedProfile.name.split(' ')[0] : 'Користувач'}
              </Text>
              <ChevronDown size={14} color={colors.textMuted} style={{ marginLeft: 4 }} />
            </Pressable>
            <TouchableOpacity style={[styles.notificationBell, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <BellSvg size={18} color={colors.text} />
              <View style={[styles.bellBadge, { backgroundColor: colors.error }]} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {timeLeft && (
        <View style={[
          styles.guestBanner,
          {
            backgroundColor: colors.warningMuted,
            borderBottomColor: colors.warning,
          }
        ]}>
          <Text style={[styles.guestBannerText, { color: colors.text }]}>
            ⏳ Демо-режим (залишилось {timeLeft}). Ваші дані будуть видалені.
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={[styles.calendarTitleText, { color: colors.text }]}>Податковий календар</Text>

        {(!dashboardData?.upcoming_events || dashboardData.upcoming_events.length === 0) ? (
          <Card style={styles.emptyCalendar}>
            <Calendar size={24} color={colors.textMuted} style={styles.emptyCalendarIcon} />
            <Text style={[styles.emptyCalendarText, { color: colors.textMuted }]}>
              Немає найближчих подій у календарі
            </Text>
          </Card>
        ) : (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={Dimensions.get('window').width - 32}
            snapToAlignment="center"
            contentContainerStyle={{ paddingVertical: 8 }}
          >
            {dashboardData.upcoming_events.map((event: any) => {
              const isReport = event.type === 'report' || event.title.includes('Подання') || event.title.includes('Розрахунок');
              const isPaid = event.status === 'paid';
              const progressPercent = isPaid ? 100 : 0;
              
              // Circular Progress Circle Calculations
              const radius = 20;
              const strokeWidth = 4;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

              return (
                <LinearGradient
                  key={event.id}
                  colors={
                    isPaid
                      ? [isDark ? 'rgba(30, 41, 59, 0.75)' : '#f1f5f9', isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff']
                      : isReport
                      ? [isDark ? 'rgba(30, 27, 75, 0.85)' : '#e0e7ff', isDark ? 'rgba(9, 13, 22, 0.85)' : '#ffffff'] // indigo glassmorphism
                      : [isDark ? 'rgba(6, 78, 59, 0.85)' : '#d1fae5', isDark ? 'rgba(9, 13, 22, 0.85)' : '#ffffff'] // emerald glassmorphism
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[
                    styles.premiumEventCard,
                    {
                      borderColor: isPaid
                        ? colors.cardBorder
                        : isReport
                        ? 'rgba(99, 102, 241, 0.35)'
                        : 'rgba(16, 185, 129, 0.35)',
                    }
                  ]}
                >
                  <View style={styles.premiumCardHeader}>
                    <Text style={[styles.premiumCardTitle, { color: colors.text }]} numberOfLines={3}>
                      {event.title}
                    </Text>
                  </View>

                  <View style={styles.deadlineRow}>
                    <Calendar size={14} color={isReport ? colors.primary : colors.success} />
                    <Text style={[styles.deadlineText, { color: colors.textMuted }]}>
                      Дедлайн: {event.due_date}
                    </Text>
                  </View>

                  {/* Middle Row with Progress Ring & Action Button */}
                  <View style={styles.premiumCardMiddle}>
                    {/* Progress Circle */}
                    <View style={styles.progressContainer}>
                      <Svg width={48} height={48}>
                        <Circle
                          cx={24}
                          cy={24}
                          r={radius}
                          stroke="rgba(255,255,255,0.08)"
                          strokeWidth={strokeWidth}
                          fill="transparent"
                        />
                        <Circle
                          cx={24}
                          cy={24}
                          r={radius}
                          stroke={isPaid ? colors.success : isReport ? colors.primary : colors.success}
                          strokeWidth={strokeWidth}
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          transform="rotate(-90 24 24)"
                        />
                      </Svg>
                      <View style={styles.progressTextContainer}>
                        <Text style={[styles.progressPercentText, { color: colors.text }]}>{progressPercent}%</Text>
                        <Text style={[styles.progressSubtext, { color: colors.textMuted }]}>Completed</Text>
                      </View>
                    </View>

                    {/* Action Button */}
                    {!isPaid ? (
                      <Pressable
                        onPress={() => {
                          if (isReport) {
                            router.push('/reports');
                          } else {
                            handleMarkEventPaid(event.id, event.title);
                          }
                        }}
                      >
                        <LinearGradient
                          colors={isReport ? ['#6366f1', '#8b5cf6'] : ['#10b981', '#059669']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.premiumCardBtn}
                        >
                          <Text style={styles.premiumCardBtnText}>
                            {isReport ? 'Подати звіт' : 'Сплатити'}
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    ) : (
                      <View style={styles.paidBadge}>
                        <CheckCircle2 size={16} color="#ffffff" />
                        <Text style={styles.paidBadgeText}>Виконано</Text>
                      </View>
                    )}
                  </View>

                  {/* Bottom Details Grid */}
                  <View style={[styles.premiumCardDetailsGrid, { borderTopColor: colors.border }]}>
                    <View style={styles.premiumDetailCol}>
                      <Text style={[styles.premiumDetailLabel, { color: colors.textMuted }]}>Період:</Text>
                      <Text style={[styles.premiumDetailValue, { color: colors.text }]} numberOfLines={1}>
                        {getEventPeriod(event.title)}
                      </Text>
                    </View>
                    <View style={styles.premiumDetailCol}>
                      <Text style={[styles.premiumDetailLabel, { color: colors.textMuted }]}>Статус:</Text>
                      <Text style={[
                        styles.premiumDetailValue,
                        { color: isPaid ? colors.success : colors.warning }
                      ]}>
                        {isPaid ? 'Виконано' : 'Майбутнє'}
                      </Text>
                    </View>
                    <View style={styles.premiumDetailCol}>
                      <Text style={[styles.premiumDetailLabel, { color: colors.textMuted }]}>Нагадування:</Text>
                      <Text style={[styles.premiumDetailValue, { color: colors.text }]}>1 день</Text>
                    </View>
                  </View>
                </LinearGradient>
              );
            })}
          </ScrollView>
        )}

        {/* Tab Switchers: "Всі події" & "Статистика" */}
        <View style={[styles.tabBarContainer, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => setActiveTab('events')}
            style={[
              styles.tabItem,
              activeTab === 'events' && [styles.activeTabItem, { borderBottomColor: colors.primary }]
            ]}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'events' ? { color: colors.text, fontWeight: '700' } : { color: colors.textMuted }
            ]}>
              Всі події
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('stats')}
            style={[
              styles.tabItem,
              activeTab === 'stats' && [styles.activeTabItem, { borderBottomColor: colors.primary }]
            ]}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'stats' ? { color: colors.text, fontWeight: '700' } : { color: colors.textMuted }
            ]}>
              Статистика
            </Text>
          </Pressable>
        </View>

        {/* Tab 1: Events View */}
        {activeTab === 'events' && (
          <View style={{ marginTop: 8 }}>
            {/* Quick Actions Panel */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Швидкі дії</Text>
            <View style={styles.quickActions}>
              <Pressable
                style={[styles.actionBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => router.push('/transactions')}
              >
                <Upload size={20} color={colors.primary} />
                <Text style={[styles.actionBoxText, { color: colors.text }]}>Імпорт виписки</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => router.push('/reports')}
              >
                <FileText size={20} color={colors.primary} />
                <Text style={[styles.actionBoxText, { color: colors.text }]}>Згенерувати звіт</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => setActiveMobileModal('pay_taxes')}
              >
                <CheckCircle2 size={20} color={colors.success} />
                <Text style={[styles.actionBoxText, { color: colors.text }]}>Сплатити податки</Text>
              </Pressable>
            </View>

            {/* AI Assistant card */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Інтерактивний ШІ-Асистент</Text>
            <Card style={[styles.aiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.aiCardHeader}>
                <MessageSquare size={18} color={colors.primary} style={styles.aiIcon} />
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
          </View>
        )}

        {/* Tab 2: Statistics / Financial Breakdown View */}
        {activeTab === 'stats' && (
          <View style={{ marginTop: 8 }}>
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

            {/* Secondary Period Details */}
            {periodType === 'month' && (
              <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8, alignItems: 'center' }}>
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {[
                    { val: 1, label: 'Січ' }, { val: 2, label: 'Лют' }, { val: 3, label: 'Бер' },
                    { val: 4, label: 'Кві' }, { val: 5, label: 'Тра' }, { val: 6, label: 'Чер' },
                    { val: 7, label: 'Лип' }, { val: 8, label: 'Сер' }, { val: 9, label: 'Вер' },
                    { val: 10, label: 'Жов' }, { val: 11, label: 'Лис' }, { val: 12, label: 'Гру' }
                  ].map((m) => (
                    <Pressable
                      key={m.val}
                      onPress={() => setSelectedMonthValue(m.val)}
                      style={[
                        styles.subPeriodBtn,
                        selectedMonthValue === m.val && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
                      ]}
                    >
                      <Text style={[styles.subPeriodBtnText, { color: colors.text }]}>{m.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {periodType === 'quarter' && (
              <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8, alignItems: 'center' }}>
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
                      <Text style={[styles.subPeriodBtnText, { color: colors.text }]}>{q} кв.</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {periodType === 'year' && (
              <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8, alignItems: 'center' }}>
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

            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
              <Pressable
                style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => setActiveMobileModal('income')}
              >
                <TrendingUp size={20} color={colors.primary} style={styles.metricIcon} />
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Дохід</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {dashboardData?.total_income?.toLocaleString('uk-UA')} ₴
                </Text>
              </Pressable>

              <Pressable
                style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => setActiveMobileModal('tax_due')}
              >
                <AlertCircle size={20} color={colors.warning} style={styles.metricIcon} />
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Нараховано</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {totalTaxesDue?.toLocaleString('uk-UA')} ₴
                </Text>
              </Pressable>
            </View>

            <View style={styles.metricsGrid}>
              <Pressable
                style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => setActiveMobileModal('tax_paid')}
              >
                <CheckCircle2 size={20} color={colors.success} style={styles.metricIcon} />
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Сплачено</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {dashboardData?.tax_paid?.toLocaleString('uk-UA')} ₴
                </Text>
              </Pressable>

              <Pressable
                style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => setActiveMobileModal('debt')}
              >
                <View style={[styles.statusDot, { backgroundColor: (dashboardData?.difference || 0) > 0 ? colors.error : colors.success }]} />
                <AlertCircle size={20} color={(dashboardData?.difference || 0) > 0 ? colors.error : colors.textMuted} style={styles.metricIcon} />
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Борг</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {dashboardData?.difference?.toLocaleString('uk-UA')} ₴
                </Text>
              </Pressable>
            </View>

            {/* Tax Breakdown Card */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Розподіл податкових зобов'язань</Text>
            <Card style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {/* Row 1: Single Tax / Profit Tax */}
              <View style={styles.breakdownRow}>
                <View>
                  <Text style={[styles.breakdownName, { color: colors.text }]}>
                    {isFop ? 'Єдиний податок' : 'Податок на прибуток'}
                  </Text>
                  <Text style={[styles.breakdownDetail, { color: colors.textMuted }]}>
                    Нараховано: {dashboardData?.tax_due?.toLocaleString('uk-UA')} ₴
                  </Text>
                </View>
                <View style={styles.breakdownRight}>
                  <Text style={[styles.breakdownPaid, { color: colors.success }]}>
                    Спл: {dashboardData?.tax_paid?.toLocaleString('uk-UA')} ₴
                  </Text>
                  <Text
                    style={[
                      styles.breakdownDiff,
                      { color: dashboardData?.tax_diff > 0 ? colors.error : colors.textMuted },
                    ]}
                  >
                    Різн: {dashboardData?.tax_diff?.toLocaleString('uk-UA')} ₴
                  </Text>
                </View>
              </View>

              {/* Row 2: Military Tax */}
              <View style={[styles.line, { backgroundColor: colors.border }]} />
              <View style={styles.breakdownRow}>
                <View>
                  <Text style={[styles.breakdownName, { color: colors.text }]}>
                    Військовий збір {dashboardData?.employee_mil_due > 0 ? (isFop ? '(ФОП + зарплати)' : '(зарплати)') : ''}
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
          </View>
        )}
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
                      <Text style={{ color: (dashboardData?.esv_diff || 0) > 0 ? colors.error : colors.success, fontSize: 13, fontWeight: '500' }}>
                        {(dashboardData?.esv_diff || 0) > 0 ? `+${dashboardData?.esv_diff} ₴` : 'Сплачено'}
                      </Text>
                    </View>

                    {((dashboardData?.employee_pit_due || 0) > 0 || (dashboardData?.pit_diff || 0) > 0) && (
                      <View style={[styles.mobileStatRow, { borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 6, marginTop: 6 }]}>
                        <View>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>ПДФО за працівників</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 10 }}>Нарах: {dashboardData?.employee_pit_due} ₴ | Спл: {dashboardData?.pit_paid} ₴</Text>
                        </View>
                        <Text style={{ color: (dashboardData?.pit_diff || 0) > 0 ? colors.error : colors.success, fontSize: 13, fontWeight: '500' }}>
                          {(dashboardData?.pit_diff || 0) > 0 ? `+${dashboardData?.pit_diff} ₴` : 'Сплачено'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Pay Taxes Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={activeMobileModal === 'pay_taxes'}
        onRequestClose={() => setActiveMobileModal(null)}
      >
        <SafeAreaView style={[styles.chatModalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.chatHeader, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.chatHeaderLeft}>
              <CheckCircle2 size={24} color={colors.success} />
              <View style={{ marginLeft: 8 }}>
                <Text style={[styles.chatHeaderTitle, { color: colors.text }]}>
                  Сплата податків
                </Text>
                <Text style={[styles.chatHeaderSubtitle, { color: colors.textMuted }]}>
                  {selectedProfile ? selectedProfile.name : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setActiveMobileModal(null)}
              style={styles.chatCloseBtn}
            >
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Закрити</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* 1. Region Selector */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 0, marginBottom: 8 }]}>Регіон оподаткування</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {[
                { id: 'kyiv', label: 'Київ' },
                { id: 'dnipro', label: 'Дніпро' },
                { id: 'lviv', label: 'Львів' },
                { id: 'odesa', label: 'Одеса' },
                { id: 'kharkiv', label: 'Харків' }
              ].map((r) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setSelectedRegion(r.id)}
                  style={[
                    styles.subPeriodBtn,
                    selectedRegion === r.id && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
                  ]}
                >
                  <Text style={[styles.subPeriodBtnText, { color: colors.text }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 2. Bank Selector */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 0, marginBottom: 8 }]}>Оберіть ваш банк</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {[
                { id: 'privat24', label: 'Приват24' },
                { id: 'monobank', label: 'monobank' },
                { id: 'abank', label: 'А-Банк' }
              ].map((b) => (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => setSelectedBank(b.id as any)}
                  style={[
                    styles.actionBox,
                    { flex: 1, backgroundColor: colors.card, borderColor: selectedBank === b.id ? colors.primary : colors.cardBorder }
                  ]}
                >
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{b.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 3. Liabilities List */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 0, marginBottom: 8 }]}>Податкові зобов'язання</Text>
            {loadingLiabilities ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
            ) : liabilities.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontStyle: 'italic', marginVertical: 10 }}>
                Не знайдено невиконаних податкових зобов'язань
              </Text>
            ) : (
              liabilities.map((liab) => (
                <Card
                  key={liab.id}
                  style={{
                    padding: 16,
                    marginBottom: 10,
                    backgroundColor: colors.card,
                    borderColor: selectedLiability?.id === liab.id ? colors.primary : colors.cardBorder,
                    borderWidth: 1
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{liab.tax_type_name}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Період: {liab.period}</Text>
                    </View>
                    <Text style={{ color: colors.error, fontWeight: '700', fontSize: 15 }}>{liab.amount?.toLocaleString('uk-UA')} ₴</Text>
                  </View>

                  <Button
                    title={selectedLiability?.id === liab.id ? "Обрано" : "Оплатити"}
                    onPress={() => handleGeneratePayment(liab)}
                    variant={selectedLiability?.id === liab.id ? "secondary" : "primary"}
                    style={{ marginTop: 12, minHeight: 36 }}
                  />
                </Card>
              ))
            )}

            {/* 4. Generated Requisites & Payment Action */}
            {generatedPayment && selectedLiability && (
              <Card style={{ padding: 16, marginTop: 16, backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
                  Реквізити для сплати {selectedLiability.tax_type_name}
                </Text>

                <View style={{ gap: 8, marginBottom: 16 }}>
                  <View>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>Отримувач:</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <Text style={{ color: colors.text, fontSize: 13, flex: 1, marginRight: 8 }}>{generatedPayment.recipient}</Text>
                      <TouchableOpacity onPress={() => handleCopyText(generatedPayment.recipient, 'Отримувача')}>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Копіювати</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.line, { backgroundColor: colors.border, marginVertical: 4 }]} />

                  <View>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>ЄДРПОУ:</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{generatedPayment.edrpou}</Text>
                      <TouchableOpacity onPress={() => handleCopyText(generatedPayment.edrpou, 'ЄДРПОУ')}>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Копіювати</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.line, { backgroundColor: colors.border, marginVertical: 4 }]} />

                  <View>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>IBAN:</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <Text style={{ color: colors.text, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', flex: 1, marginRight: 8 }}>{generatedPayment.iban}</Text>
                      <TouchableOpacity onPress={() => handleCopyText(generatedPayment.iban, 'IBAN')}>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Копіювати</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.line, { backgroundColor: colors.border, marginVertical: 4 }]} />

                  <View>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>Призначення платежу:</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <Text style={{ color: colors.text, fontSize: 12, flex: 1, marginRight: 8 }} numberOfLines={3}>{generatedPayment.purpose}</Text>
                      <TouchableOpacity onPress={() => handleCopyText(generatedPayment.purpose, 'Призначення')}>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Копіювати</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <Button
                  title={`Перейти до сплати в ${selectedBank === 'privat24' ? 'Приват24' : selectedBank === 'monobank' ? 'monobank' : 'А-Банк'}`}
                  onPress={handleOpenBankLink}
                  variant="primary"
                  style={{ marginBottom: 10 }}
                />

                <Button
                  title="Підтвердити оплату вручну"
                  onPress={handleConfirmPayment}
                  variant="outline"
                />
              </Card>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  userNameText: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 80,
  },
  notificationBell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  calendarTitleText: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  premiumEventCard: {
    width: Dimensions.get('window').width - 32,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginRight: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  premiumCardHeader: {
    marginBottom: 6,
  },
  premiumCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  deadlineText: {
    fontSize: 12,
    fontWeight: '600',
  },
  premiumCardMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTextContainer: {
    justifyContent: 'center',
  },
  progressPercentText: {
    fontSize: 14,
    fontWeight: '800',
  },
  progressSubtext: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  premiumCardBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  premiumCardBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10b981',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  paidBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  premiumCardDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 14,
  },
  premiumDetailCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  premiumDetailLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  premiumDetailValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabBarContainer: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
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
    borderRadius: 20,
    borderWidth: 1,
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
  guestBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  guestBannerText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
