import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Alert,
  TextInput,
  Pressable,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
  Platform,
  Dimensions,
  Clipboard,
  Image,
  ImageBackground,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api, API_BASE_URL } from '../../services/api';
import {
  Gauge,
  Lock,
  Unlock,
  AlertCircle,
  FolderOpen,
  Shield,
  Calendar as CalendarIcon,
  Wrench,
  Cpu,
  Camera,
  Check,
  X,
  Plus,
  Minus,
  Thermometer,
  Wifi,
  ChevronRight,
  Clock,
  Briefcase,
  Phone,
  CreditCard,
  Home
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function ResidentDashboard() {
  const { colors, isDark } = useTheme();
  const { memberToken, logout } = useAuth();
  
  // Dashboard primary states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [meterInputs, setMeterInputs] = useState<Record<number, string>>({});
  const [submittingMeterId, setSubmittingMeterId] = useState<number | null>(null);
  
  const [payAmount, setPayAmount] = useState('');
  const [payPurpose, setPayPurpose] = useState<'regular' | 'utility'>('regular');
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal selector state
  const [activeModal, setActiveModal] = useState<'documents' | 'security' | 'bookings' | 'services' | 'smart_home' | 'contacts' | 'billing_history' | 'board' | null>(null);

  // 1. Documents Modal states
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docFilter, setDocFilter] = useState<'all' | 'minutes' | 'budget' | 'report' | 'decision'>('all');

  // 2. Security Modal states
  const [securityDevices, setSecurityDevices] = useState<any[]>([]);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [unlockingDeviceId, setUnlockingDeviceId] = useState<number | null>(null);
  const [unlockingCountdown, setUnlockingCountdown] = useState(0);
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [liveTime, setLiveTime] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 3. Bookings Modal states
  const [recreationZones, setRecreationZones] = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingTab, setBookingTab] = useState<'book' | 'my'>('book');
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [bookingDate, setBookingDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [bookingStart, setBookingStart] = useState('12:00');
  const [bookingEnd, setBookingEnd] = useState('14:00');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // 4. Services Modal states
  const [myServices, setMyServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [serviceType, setServiceType] = useState('cleaning');
  const [serviceDesc, setServiceDesc] = useState('');
  const [servicePreferredTime, setServicePreferredTime] = useState('Завтра з 10:00');
  const [submittingService, setSubmittingService] = useState(false);

  // 5. Smart Home Modal states
  const [heatingDevice, setHeatingDevice] = useState<any>(null);
  const [smartMeters, setSmartMeters] = useState<any[]>([]);
  const [loadingSmart, setLoadingSmart] = useState(false);
  const [syncingSmartMeters, setSyncingSmartMeters] = useState(false);
  const [updatingHeating, setUpdatingHeating] = useState(false);

  // 6. Contacts Modal states
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // 7. Board Workspace states
  const [boardIssues, setBoardIssues] = useState<any[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueDesc, setNewIssueDesc] = useState('');
  const [voteComments, setVoteComments] = useState<Record<number, string>>({});
  const [isSigningIssueId, setIsSigningIssueId] = useState<number | null>(null);
  const [signCertId, setSignCertId] = useState<number | null>(null);
  const [signPassword, setSignPassword] = useState('');
  const [certificates, setCertificates] = useState<any[]>([]);

  const loadDashboardData = async () => {
    if (!memberToken) return;
    try {
      const response = await api.getMemberDashboard(memberToken);
      setData(response);
      
      if (response?.meters) {
        const initialMeterInputs: Record<number, string> = {};
        response.meters.forEach((meter: any) => {
          if (meter.is_submitted && meter.current_submitted_value !== undefined && meter.current_submitted_value !== null) {
            initialMeterInputs[meter.id] = String(meter.current_submitted_value);
          }
        });
        setMeterInputs(prev => ({ ...initialMeterInputs, ...prev }));
      }
      
      const bal = Number(response?.member?.balance || 0);
      if (bal < 0) {
        setPayAmount(String(Math.abs(bal)));
      }
    } catch (e: any) {
      console.error('Error loading resident dashboard:', e);
      if (e.message?.includes('401') || e.message?.includes('403')) {
        Alert.alert('Сесія закінчилась', 'Будь ласка, авторизуйтесь знову.');
        logout();
      } else {
        Alert.alert('Помилка', 'Не вдалося завантажити дані кабінету.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [memberToken]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handlePayMono = async () => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Помилка', 'Введіть коректну суму для оплати.');
      return;
    }
    const descriptionText = payPurpose === 'utility'
      ? `Оплата за електроенергію, о/р ${data.member.account_number || data.member.identifier}`
      : `Оплата внесків, о/р ${data.member.account_number || data.member.identifier}`;

    try {
      setLoading(true);
      const res = await api.createMemberMonoInvoice(memberToken!, {
        amount: amount,
        charge_type: payPurpose,
        description: descriptionText,
      });
      if (res.pageUrl) {
        Linking.openURL(res.pageUrl);
      } else {
        Alert.alert('Помилка', 'Не вдалося створити рахунок оплати.');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e.message || 'Помилка при створенні рахунку Monobank.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayLiqpay = async () => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Помилка', 'Введіть коректну суму для оплати.');
      return;
    }
    const descriptionText = payPurpose === 'utility'
      ? `Оплата за електроенергію, о/р ${data.member.account_number || data.member.identifier}`
      : `Оплата внесків, о/р ${data.member.account_number || data.member.identifier}`;
    const url = `${API_BASE_URL}/api/member/billing/liqpay/pay-redirect?amount=${amount}&charge_type=${payPurpose}&description=${encodeURIComponent(descriptionText)}&token=${memberToken}`;
    Linking.openURL(url);
  };

  const handleDownloadReceipt = () => {
    const url = `${API_BASE_URL}/api/member/receipt/pdf?token=${memberToken}`;
    Linking.openURL(url);
  };

  const handleMeterSubmit = async (meter: any) => {
    const rawVal = meterInputs[meter.id];
    if (!rawVal || rawVal.trim() === '') {
      Alert.alert('Помилка', 'Введіть поточне показання лічильника.');
      return;
    }
    const value = parseFloat(rawVal);
    if (isNaN(value)) {
      Alert.alert('Помилка', 'Показник лічильника має бути числом.');
      return;
    }
    
    const prev = parseFloat(meter.previous_value || 0);
    if (value < prev) {
      Alert.alert('Валідація', 'Нові показання не можуть бути меншими за попередні!');
      return;
    }

    try {
      setSubmittingMeterId(meter.id);
      await api.submitMemberMeterReading(memberToken!, meter.id, {
        reading_value: value,
      });
      Alert.alert('Успішно', 'Показання лічильника збережено.');
      setMeterInputs(prevInputs => ({ ...prevInputs, [meter.id]: '' }));
      loadDashboardData();
    } catch (e: any) {
      Alert.alert('Помилка', e.message || 'Не вдалося надіслати показання.');
    } finally {
      setSubmittingMeterId(null);
    }
  };

  // --- 1. DOCUMENTS API TRIGGER ---
  const openDocuments = async () => {
    setActiveModal('documents');
    setLoadingDocs(true);
    try {
      const docs = await api.getMemberDocuments(memberToken!);
      setDocuments(docs);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити документи');
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleDownloadDoc = (doc: any) => {
    const url = `${API_BASE_URL}/api/member/documents/${doc.id}/download?token=${memberToken}`;
    Linking.openURL(url);
  };

  // --- 2. SECURITY API TRIGGER ---
  const openSecurity = async () => {
    setActiveModal('security');
    setLoadingSecurity(true);
    try {
      const devices = await api.getMemberSecurityDevices(memberToken!);
      setSecurityDevices(devices);
      const cam = devices.find((d: any) => d.device_type === 'camera');
      if (cam) setSelectedCamera(cam);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити пристрої безпеки');
    } finally {
      setLoadingSecurity(false);
    }

    // Start Live Clock
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const now = new Date();
      setLiveTime(now.toLocaleString('uk-UA'));
    }, 1000);
  };

  const closeSecurity = () => {
    setActiveModal(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleUnlockDevice = async (device: any) => {
    try {
      setUnlockingDeviceId(device.id);
      setUnlockingCountdown(3);
      
      const interval = setInterval(() => {
        setUnlockingCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      await api.unlockMemberSecurityDevice(memberToken!, device.id);
      
      setTimeout(() => {
        setUnlockingDeviceId(null);
        Alert.alert('Успішно', `${device.name} відчинено!`);
      }, 3000);

    } catch (e: any) {
      setUnlockingDeviceId(null);
      Alert.alert('Помилка', e.message || 'Не вдалося відкрити пристрій');
    }
  };

  // --- 3. BOOKINGS API TRIGGER ---
  const openBookings = async () => {
    setActiveModal('bookings');
    setLoadingBookings(true);
    try {
      const zones = await api.getMemberRecreationZones(memberToken!);
      setRecreationZones(zones);
      if (zones.length > 0) setSelectedZone(zones[0]);
      
      const bookings = await api.getMyBookings(memberToken!);
      setMyBookings(bookings);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити бронювання');
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleCreateBooking = async () => {
    if (!selectedZone) return;
    setSubmittingBooking(true);
    try {
      await api.createMemberBooking(memberToken!, {
        zone_id: selectedZone.id,
        booking_date: bookingDate,
        start_time: bookingStart,
        end_time: bookingEnd,
      });
      Alert.alert('Успішно', 'Бронювання надіслано та підтверджено!');
      
      // reload
      const bookings = await api.getMyBookings(memberToken!);
      setMyBookings(bookings);
      setBookingTab('my');
    } catch (e: any) {
      Alert.alert('Помилка', e.message || 'Цей часовий інтервал вже зайнятий.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleCancelBooking = async (id: number) => {
    Alert.alert('Скасування', 'Ви впевнені, що хочете скасувати бронювання?', [
      { text: 'Ні' },
      {
        text: 'Так, скасувати',
        onPress: async () => {
          try {
            await api.cancelMemberBooking(memberToken!, id);
            const bookings = await api.getMyBookings(memberToken!);
            setMyBookings(bookings);
          } catch (e: any) {
            Alert.alert('Помилка', e.message || 'Не вдалося скасувати');
          }
        }
      }
    ]);
  };

  // --- 4. SERVICES API TRIGGER ---
  const openServices = async () => {
    setActiveModal('services');
    setLoadingServices(true);
    try {
      const list = await api.getMyServices(memberToken!);
      setMyServices(list);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити список послуг');
    } finally {
      setLoadingServices(false);
    }
  };

  const handleCreateServiceOrder = async () => {
    if (!serviceDesc.trim()) {
      Alert.alert('Помилка', 'Введіть опис проблеми чи замовлення');
      return;
    }
    setSubmittingService(true);
    try {
      await api.createMemberServiceOrder(memberToken!, {
        service_type: serviceType,
        description: serviceDesc,
        preferred_time: servicePreferredTime,
      });
      Alert.alert('Успіх', 'Послугу успішно замовлено!');
      setServiceDesc('');
      
      // reload
      const list = await api.getMyServices(memberToken!);
      setMyServices(list);
    } catch (e: any) {
      Alert.alert('Помилка', e.message || 'Не вдалося створити замовлення');
    } finally {
      setSubmittingService(false);
    }
  };

  // --- 5. SMART HOME API TRIGGER ---
  const openSmartHome = async () => {
    setActiveModal('smart_home');
    setLoadingSmart(true);
    try {
      const heat = await api.getMemberHeatingDevice(memberToken!);
      setHeatingDevice(heat);
      const logs = await api.getSmartMetersTransmissionLogs(memberToken!);
      setSmartMeters(logs);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити дані пристроїв');
    } finally {
      setLoadingSmart(false);
    }
  };

  const handleTargetTempChange = async (diff: number) => {
    if (!heatingDevice || updatingHeating) return;
    const newTemp = Math.max(16.0, Math.min(28.0, heatingDevice.target_temperature + diff));
    setUpdatingHeating(true);
    
    // Optimistic UI update
    setHeatingDevice({ ...heatingDevice, target_temperature: newTemp });
    
    try {
      const res = await api.controlMemberHeating(memberToken!, {
        target_temperature: newTemp,
        mode: heatingDevice.mode,
      });
      setHeatingDevice(res);
    } catch (e: any) {
      Alert.alert('Помилка', e.message || 'Не вдалося зберегти режим');
      openSmartHome(); // rollback
    } finally {
      setUpdatingHeating(false);
    }
  };

  const handleHeatingModeChange = async (mode: string) => {
    if (!heatingDevice || updatingHeating) return;
    setUpdatingHeating(true);
    
    // Optimistic UI update
    setHeatingDevice({ ...heatingDevice, mode });
    
    try {
      const res = await api.controlMemberHeating(memberToken!, {
        target_temperature: heatingDevice.target_temperature,
        mode: mode,
      });
      setHeatingDevice(res);
    } catch (e: any) {
      Alert.alert('Помилка', e.message || 'Не вдалося змінити режим');
      openSmartHome(); // rollback
    } finally {
      setUpdatingHeating(false);
    }
  };

  const handleSyncSmartMeters = async () => {
    setSyncingSmartMeters(true);
    try {
      const logs = await api.getSmartMetersTransmissionLogs(memberToken!);
      setSmartMeters(logs);
      Alert.alert('Синхронізація', 'Показники розумних пристроїв успішно синхронізовано з хмарою ОСББ!');
    } catch (e: any) {
      Alert.alert('Помилка', 'Синхронізація не вдалася');
    } finally {
      setSyncingSmartMeters(false);
    }
  };

  // --- 6. CONTACTS API TRIGGER ---
  const openContacts = async () => {
    setActiveModal('contacts');
    setLoadingContacts(true);
    try {
      const list = await api.getMemberContacts(memberToken!);
      setContacts(list);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити контакти');
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleCallPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const openBillingHistory = async () => {
    setActiveModal('billing_history');
    setLoadingHistory(true);
    try {
      const history = await api.getMemberBillingHistory(memberToken!);
      setBillingHistory(history || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити історію фінансів');
    } finally {
      setLoadingHistory(false);
    }
  };

  // --- 7. BOARD OF DIRECTORS WORKSPACE ACTIONS ---
  const fetchBoardIssuesInternal = async () => {
    try {
      const list = await api.getBoardIssues(memberToken!);
      setBoardIssues(list || []);
    } catch (e) {
      console.error(e);
    }
  };

  const openBoardWorkspace = async () => {
    setActiveModal('board');
    setLoadingBoard(true);
    try {
      await fetchBoardIssuesInternal();
      if (data?.profile?.id) {
        const certs = await api.getCertificates(data.profile.id);
        setCertificates(certs || []);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити робочий простір правління');
    } finally {
      setLoadingBoard(false);
    }
  };

  const handleCreateIssue = async () => {
    if (!newIssueTitle.trim()) {
      Alert.alert('Помилка', 'Введіть тему питання');
      return;
    }
    setLoadingBoard(true);
    try {
      await api.createBoardIssue(memberToken!, {
        title: newIssueTitle.trim(),
        description: newIssueDesc.trim() || undefined
      });
      setNewIssueTitle('');
      setNewIssueDesc('');
      setIsCreatingIssue(false);
      await fetchBoardIssuesInternal();
      Alert.alert('Успіх', 'Питання створено для обговорення');
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося створити питання');
    } finally {
      setLoadingBoard(false);
    }
  };

  const handleStartVoting = async (issueId: number) => {
    setLoadingBoard(true);
    try {
      await api.startBoardVoting(memberToken!, issueId);
      await fetchBoardIssuesInternal();
      Alert.alert('Голосування', 'Голосування запущено для цього питання');
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося запустити голосування');
    } finally {
      setLoadingBoard(false);
    }
  };

  const handleVote = async (issueId: number, value: string) => {
    const comment = voteComments[issueId] || '';
    setLoadingBoard(true);
    try {
      await api.voteBoardIssue(memberToken!, issueId, {
        vote_value: value,
        comment: comment.trim() || undefined
      });
      await fetchBoardIssuesInternal();
      Alert.alert('Голос', 'Ваш голос успішно враховано');
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося проголосувати');
    } finally {
      setLoadingBoard(false);
    }
  };

  const handleEndVoting = async (issueId: number) => {
    setLoadingBoard(true);
    try {
      await api.endBoardVoting(memberToken!, issueId);
      await fetchBoardIssuesInternal();
      Alert.alert('Голосування', 'Голосування завершено, сформовано протокол ШІ');
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завершити голосування');
    } finally {
      setLoadingBoard(false);
    }
  };

  const handleSignProtocol = async () => {
    if (!isSigningIssueId) return;
    setLoadingBoard(true);
    try {
      await api.signBoardProtocol(memberToken!, isSigningIssueId, {
        password: signPassword || undefined,
        certificate_id: signCertId || undefined
      });
      setIsSigningIssueId(null);
      setSignCertId(null);
      setSignPassword('');
      await fetchBoardIssuesInternal();
      
      // Reload documents
      if (memberToken) {
        const docs = await api.getMemberDocuments(memberToken);
        setDocuments(docs || []);
      }
      
      Alert.alert('Підпис', 'Протокол успішно підписано та опубліковано у документах');
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося підписати протокол');
    } finally {
      setLoadingBoard(false);
    }
  };

  // Automated notification helpers (test button triggers)
  const handleTriggerTestReminder = async () => {
    try {
      await api.triggerTestMemberNotification(memberToken!);
      Alert.alert('Надіслано', 'Тестове нагадування успішно надіслано (Push / Email). Перевірте ваш девайс!');
    } catch (e: any) {
      Alert.alert('Помилка', e.message || 'Помилка надсилання сповіщення');
    }
  };

  const handleSimulateAutomatedCron = async () => {
    try {
      const res = await api.simulateNotificationCheck(memberToken!);
      const sentCount = res.notifications_sent?.length || 0;
      if (sentCount > 0) {
        Alert.alert('Симуляція виконана', `Знайдено та надіслано нагадувань: ${sentCount} (${res.notifications_sent.join(', ')}).`);
      } else {
        Alert.alert('Симуляція виконана', 'Заборгованостей чи пропущених лічильників не виявлено. Нагадування не потрібні.');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e.message || 'Помилка тестування');
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Завантаження кабінету...</Text>
      </View>
    );
  }

  const member = data?.member;
  const profile = data?.profile;
  const balance = member?.balance || 0;

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    if (docFilter === 'all') return true;
    return doc.document_type === docFilter;
  });

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Header Banner Image with organization overlay */}
      <ImageBackground 
        source={profile?.header_image_url ? { uri: profile.header_image_url.startsWith('/') ? `${API_BASE_URL}${profile.header_image_url}` : profile.header_image_url } : require('../../assets/suburban_neighborhood.jpg')} 
        style={styles.headerBanner}
        imageStyle={styles.headerBannerImage}
      >
        <View style={styles.headerOverlay}>
          <View style={[styles.floatingOrgCard, { backgroundColor: isDark ? 'rgba(11, 15, 25, 0.88)' : 'rgba(255, 255, 255, 0.92)', borderColor: colors.warning }]}>
            <View style={[styles.floatingOrgIconCircle, { backgroundColor: colors.primaryMuted }]}>
              <Home size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.floatingOrgName, { color: colors.text }]} numberOfLines={2}>
                {profile?.name || 'Садове Товариство'}
              </Text>
              <Text style={[styles.floatingOrgSub, { color: colors.textMuted }]}>
                {profile?.bank_name || 'м. Дніпро, вул. Іжевська 1'}
              </Text>
            </View>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.mainContent}>
        {/* Property Address Card (🔑 Key card style like Dah) */}
        <Card style={[styles.propertyInfoCard, { borderColor: colors.warning, borderWidth: 1.5 }]}>
          <View style={styles.propertyRow}>
            <View style={[styles.propertyIconContainer, { backgroundColor: colors.primaryMuted }]}>
              <Text style={{ fontSize: 20 }}>🔑</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.propertyLabel, { color: colors.textMuted }]}>ОБ'ЄКТ ТА АДРЕСА</Text>
              <Text style={[styles.propertyValue, { color: colors.text }]}>
                {member?.property_type || 'кв.'} {member?.identifier}
              </Text>
              <Text style={[styles.accountNumberText, { color: colors.textMuted }]}>
                особовий рахунок: {member?.account_number || 'Не призначено'}
              </Text>
            </View>
          </View>
          <View style={[styles.ownerBadge, { backgroundColor: colors.inputBg }]}>
            <Text style={[styles.ownerName, { color: colors.text }]} numberOfLines={1}>
              👤 {member?.owner_name || 'Шановний мешканець'}
            </Text>
          </View>
        </Card>

        {/* Balance card */}
        <Card style={[styles.balanceCard, { borderColor: colors.warning, borderWidth: 1.5 }]}>
          <Pressable onPress={openBillingHistory}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Поточний баланс (Натисніть для історії)</Text>
            <Text style={[
              styles.balanceText, 
              { color: balance < 0 ? '#f97316' : '#84cc16' }
            ]}>
              {balance.toFixed(2)} грн
            </Text>
          </Pressable>
          <Text style={[styles.subLabel, { color: colors.textMuted }]}>
            {balance < 0 ? 'У вас є заборгованість' : 'Передплата / Борг відсутній'}
          </Text>

          {(() => {
            const totalDebt = balance < 0 ? Math.abs(balance) : 0;
            const duesDebt = member?.dues_debt || 0;
            const utilityDebt = Math.max(0, totalDebt - duesDebt);
            return (
              <>
                {duesDebt > 0 && (
                  <View style={[styles.duesDebtAlert, { backgroundColor: isDark ? 'rgba(249, 115, 22, 0.12)' : '#fffbeb', borderColor: isDark ? 'rgba(249, 115, 22, 0.3)' : '#fde68a', marginBottom: utilityDebt > 0 ? 6 : 0 }]}>
                    <Text style={[styles.duesDebtAlertText, { color: isDark ? '#fb923c' : '#d97706' }]}>
                      ⚠️ Борг по внесках: <Text style={{ fontWeight: 'bold' }}>{duesDebt.toFixed(2)} грн</Text>
                    </Text>
                  </View>
                )}
                {utilityDebt > 0 && (
                  <View style={[styles.duesDebtAlert, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca' }]}>
                    <Text style={[styles.duesDebtAlertText, { color: isDark ? '#f87171' : '#dc2626' }]}>
                      ⚡ Борг за електроенергію: <Text style={{ fontWeight: 'bold' }}>{utilityDebt.toFixed(2)} грн</Text>
                    </Text>
                  </View>
                )}
              </>
            );
          })()}

          <View style={[styles.actionButtons, { flexDirection: 'column', gap: 12 }]}>
            {(data?.profile?.has_monobank || data?.profile?.has_liqpay) && (
              <View style={{ width: '100%', gap: 8 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>
                  Швидка онлайн-оплата
                </Text>
                
                {/* Payment purpose selector */}
                <View style={{ flexDirection: 'row', backgroundColor: colors.inputBg, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 4 }}>
                  <Pressable
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      alignItems: 'center',
                      borderRadius: 8,
                      backgroundColor: payPurpose === 'regular' ? colors.primary : 'transparent',
                    }}
                    onPress={() => setPayPurpose('regular')}
                  >
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: payPurpose === 'regular' ? '#ffffff' : colors.text }}>
                      Членські внески
                    </Text>
                  </Pressable>
                  <Pressable
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      alignItems: 'center',
                      borderRadius: 8,
                      backgroundColor: payPurpose === 'utility' ? colors.primary : 'transparent',
                    }}
                    onPress={() => setPayPurpose('utility')}
                  >
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: payPurpose === 'utility' ? '#ffffff' : colors.text }}>
                      Електроенергія
                    </Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 10, backgroundColor: colors.inputBg, paddingHorizontal: 12, height: 44 }}>
                  <TextInput
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 14,
                      fontWeight: 'bold',
                    }}
                    placeholder="Введіть суму"
                    placeholderTextColor={colors.textMuted + '80'}
                    value={payAmount}
                    onChangeText={setPayAmount}
                    keyboardType="numeric"
                  />
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textMuted }}>грн</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  {data?.profile?.has_monobank && (
                    <Button
                      title="Mono Pay"
                      onPress={handlePayMono}
                      style={{ flex: 1 }}
                    />
                  )}
                  {data?.profile?.has_liqpay && (
                    <Button
                      title="LiqPay"
                      onPress={handlePayLiqpay}
                      variant="secondary"
                      style={{ flex: 1 }}
                    />
                  )}
                </View>
              </View>
            )}
            <View style={{ width: '100%', gap: 8, marginTop: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>
                Рахунок на оплату
              </Text>
              <Button
                title="Отримати квитанцію (PDF)"
                onPress={handleDownloadReceipt}
                variant="outline"
                style={{ width: '100%' }}
              />
            </View>
          </View>
        </Card>

        {/* Bank Transfer Details Section */}
        {profile?.iban && (
          <Card style={{ padding: 16, marginTop: 12, gap: 12, borderColor: colors.warning, borderWidth: 1.5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CreditCard size={20} color={colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>Реквізити для оплати (IBAN)</Text>
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder }}>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: 'bold', textTransform: 'uppercase' }}>Рахунок отримувача</Text>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.text, marginVertical: 4 }}>{profile.iban}</Text>
                <Pressable onPress={() => {
                  Clipboard.setString(profile.iban);
                  Alert.alert('Скопійовано', 'IBAN скопійовано в буфер обміну.');
                }}>
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: 'bold' }}>Скопіювати IBAN</Text>
                </Pressable>
              </View>
              
              {profile.tax_id && (
                <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder }}>
                  <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: 'bold', textTransform: 'uppercase' }}>Код ЄДРПОУ</Text>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.text, marginVertical: 4 }}>{profile.tax_id}</Text>
                  <Pressable onPress={() => {
                    Clipboard.setString(profile.tax_id);
                    Alert.alert('Скопійовано', 'Код ЄДРПОУ скопійовано.');
                  }}>
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: 'bold' }}>Скопіювати ЄДРПОУ</Text>
                  </Pressable>
                </View>
              )}

              <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', padding: 12, borderRadius: 12 }}>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: 'bold', textTransform: 'uppercase' }}>Отримувач / Банк</Text>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.text, marginTop: 4 }}>{profile.bank_name || profile.name}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Premium Quick Action Grid */}
        <View style={styles.sectionHeader}>
          <Cpu size={22} color={colors.primary} style={styles.sectionIcon} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Розумний кабінет (Преміум)</Text>
        </View>

        <View style={styles.gridContainer}>
          {/* Row 1 */}
          <View style={styles.gridRow}>
            <Pressable style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.warning, borderWidth: 1.2 }]} onPress={openDocuments}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
                <FolderOpen size={24} color="#06b6d4" />
              </View>
              <Text style={[styles.gridTitle, { color: colors.text }]}>Документи</Text>
              <Text style={[styles.gridSubtitle, { color: colors.textMuted }]}>Рішення, кошториси</Text>
            </Pressable>

            <Pressable style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.warning, borderWidth: 1.2 }]} onPress={openSecurity}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Shield size={24} color="#ef4444" />
              </View>
              <Text style={[styles.gridTitle, { color: colors.text }]}>Безпека</Text>
              <Text style={[styles.gridSubtitle, { color: colors.textMuted }]}>Камери & ворота</Text>
            </Pressable>
          </View>

          {/* Row 2 */}
          <View style={styles.gridRow}>
            <Pressable style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.warning, borderWidth: 1.2 }]} onPress={openBookings}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <CalendarIcon size={24} color="#10b981" />
              </View>
              <Text style={[styles.gridTitle, { color: colors.text }]}>Бронювання</Text>
              <Text style={[styles.gridSubtitle, { color: colors.textMuted }]}>Зони відпочинку</Text>
            </Pressable>

            <Pressable style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.warning, borderWidth: 1.2 }]} onPress={openServices}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Wrench size={24} color="#a855f7" />
              </View>
              <Text style={[styles.gridTitle, { color: colors.text }]}>Сервіси</Text>
              <Text style={[styles.gridSubtitle, { color: colors.textMuted }]}>Клінінг, ремонт</Text>
            </Pressable>
          </View>

          {/* Row 3 */}
          <View style={styles.gridRow}>
            <Pressable style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.warning, borderWidth: 1.2 }]} onPress={openSmartHome}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
                <Cpu size={24} color="#f97316" />
              </View>
              <Text style={[styles.gridTitle, { color: colors.text }]}>Розумний Дім</Text>
              <Text style={[styles.gridSubtitle, { color: colors.textMuted }]}>Телеметрія & опалення</Text>
            </Pressable>

            <Pressable style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.warning, borderWidth: 1.2 }]} onPress={openContacts}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Phone size={24} color="#3b82f6" />
              </View>
              <Text style={[styles.gridTitle, { color: colors.text }]}>Контакти</Text>
              <Text style={[styles.gridSubtitle, { color: colors.textMuted }]}>Телефони правління</Text>
            </Pressable>
          </View>

          {/* Row 4 (Board of Directors - Правління) */}
          {data?.member?.is_board_member && (
            <View style={styles.gridRow}>
              <Pressable style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.2 }]} onPress={openBoardWorkspace}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                  <FolderOpen size={24} color={colors.primary} />
                </View>
                <Text style={[styles.gridTitle, { color: colors.text }]}>Правління</Text>
                <Text style={[styles.gridSubtitle, { color: colors.textMuted }]}>Голосування & протоколи</Text>
              </Pressable>

              {/* Empty placeholder item to keep grid alignment */}
              <View style={[styles.gridItem, { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 }]} />
            </View>
          )}
        </View>

        {/* Meter readings header */}
        <View style={styles.sectionHeader}>
          <Gauge size={22} color={colors.primary} style={styles.sectionIcon} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Показання лічильників (Ручне введення)</Text>
        </View>

        {/* Meter reading list */}
        {data?.meters && data.meters.length > 0 ? (
          data.meters.map((meter: any) => (
            <Card key={meter.id} style={[styles.meterCard, { borderColor: colors.warning, borderWidth: 1.2 }]}>
              <View style={styles.meterRow}>
                <View style={styles.meterInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.meterName, { color: colors.text }]}>{meter.name}</Text>
                    {meter.is_submitted && (
                      <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ color: '#10b981', fontSize: 9, fontWeight: 'bold' }}>Надіслано</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.meterPrev, { color: colors.textMuted }]}>
                    Попереднє значення: {meter.previous_value}
                  </Text>
                </View>

                {meter.is_locked ? (
                  <View style={styles.lockBadge}>
                    <Lock size={14} color={colors.textMuted} />
                    <Text style={[styles.lockText, { color: colors.textMuted }]}>Період закрито</Text>
                  </View>
                ) : null}
              </View>

              {!meter.is_locked ? (
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.inputBg }]}
                    placeholder="Введіть нове показання"
                    placeholderTextColor={colors.textMuted + '80'}
                    value={meterInputs[meter.id] || ''}
                    onChangeText={(text) => setMeterInputs({ ...meterInputs, [meter.id]: text })}
                    keyboardType="numeric"
                  />
                  <Pressable 
                    style={[styles.submitButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleMeterSubmit(meter)}
                    disabled={submittingMeterId === meter.id}
                  >
                    {submittingMeterId === meter.id ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.submitButtonText}>{meter.is_submitted ? 'Зберегти' : 'OK'}</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={styles.lockedPlaceholder}>
                  <Lock size={16} color={colors.textMuted} />
                  <Text style={[styles.lockedPlaceholderText, { color: colors.textMuted }]}>
                    Внесення показань заблоковано адміністрацією
                  </Text>
                </View>
              )}
            </Card>
          ))
        ) : (
          <Card style={[styles.emptyCard, { borderColor: colors.warning, borderWidth: 1.2 }]}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              У вашому профілі немає активних лічильників.
            </Text>
          </Card>
        )}

        {/* Automated reminders trigger & simulation box */}
        <View style={styles.sectionHeader}>
          <Clock size={22} color={colors.primary} style={styles.sectionIcon} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Авто-сповіщення & Нагадування</Text>
        </View>
        
        <Card style={[styles.reminderCard, { borderColor: colors.warning, borderWidth: 1.2 }]}>
          <Text style={[styles.reminderTitle, { color: colors.text }]}>Тестування розумних нагадувань</Text>
          <Text style={[styles.reminderDesc, { color: colors.textMuted }]}>
            Система автоматично нагадує про дедлайни платежів (до 25 числа) та передачі показників лічильників (до кінця місяця).
          </Text>
          <View style={styles.reminderButtons}>
            <Button
              title="Надіслати мені тест"
              onPress={handleTriggerTestReminder}
              style={styles.reminderBtn}
              textStyle={{ fontSize: 13 }}
            />
            <Button
              title="Симулювати Скан Дедлайнів"
              onPress={handleSimulateAutomatedCron}
              variant="outline"
              style={styles.reminderBtn}
              textStyle={{ fontSize: 13 }}
            />
          </View>
        </Card>

        {/* No P2P chat warning */}
        <View style={[styles.warningRow, { borderColor: colors.warning, borderWidth: 1.2 }]}>
          <AlertCircle size={16} color={colors.primary} />
          <Text style={[styles.warningText, { color: colors.textMuted }]}>
            Кабінет працює в режимі суворої ізоляції. Загальні чати мешканців відсутні задля запобігання конфліктам та спаму.
          </Text>
        </View>
      </View>


      {/* ========================================================================= */}
      {/* 7. BILLING HISTORY MODAL OVERLAY */}
      {/* ========================================================================= */}
      <Modal visible={activeModal === 'billing_history'} animationType="slide" transparent={true} onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalOverlayHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Історія нарахувань та оплат</Text>
            <Pressable style={styles.closeBtn} onPress={() => setActiveModal(null)}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={[styles.modalBody, { backgroundColor: colors.background }]}>
            {loadingHistory ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : billingHistory.length > 0 ? (
              <FlatList
                data={billingHistory}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => {
                  const isCharge = item.type === 'charge';
                  return (
                    <Card style={[styles.docItemCard, { borderLeftWidth: 4, borderLeftColor: isCharge ? '#f97316' : '#10b981' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.textMuted, textTransform: 'uppercase' }}>
                          {isCharge ? 'Нарахування' : 'Оплата'}
                        </Text>
                        <Text style={{ fontSize: 10, color: colors.textMuted }}>{item.date}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.text, marginVertical: 6 }}>
                        {item.description}
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: isCharge ? '#f97316' : '#10b981' }}>
                        {isCharge ? '-' : '+'}{item.amount.toFixed(2)} грн
                      </Text>
                    </Card>
                  );
                }}
              />
            ) : (
              <View style={styles.center}>
                <FolderOpen size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: 12 }]}>Історія порожня.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 1. DOCUMENTS MODAL OVERLAY */}
      {/* ========================================================================= */}
      <Modal visible={activeModal === 'documents'} animationType="slide" transparent={true} onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalOverlayHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Офіційні документи ОСББ</Text>
            <Pressable style={styles.closeBtn} onPress={() => setActiveModal(null)}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={[styles.modalBody, { backgroundColor: colors.background }]}>
            {/* Filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterScrollContent}>
              {(['all', 'minutes', 'budget', 'report', 'decision'] as const).map((type) => {
                const label = type === 'all' ? 'Всі' : type === 'minutes' ? 'Протоколи' : type === 'budget' ? 'Кошториси' : type === 'report' ? 'Фінанси' : 'Рішення';
                const active = docFilter === type;
                return (
                  <Pressable key={type} style={[styles.filterPill, active && { backgroundColor: colors.primary }]} onPress={() => setDocFilter(type)}>
                    <Text style={[styles.filterText, { color: active ? '#fff' : colors.textMuted }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {loadingDocs ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : filteredDocs.length > 0 ? (
              <FlatList
                data={filteredDocs}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <Card style={styles.docItemCard}>
                    <View style={styles.docHeaderRow}>
                      <FolderOpen size={20} color={colors.primary} style={{ marginRight: 8 }} />
                      <Text style={[styles.docFilename, { color: colors.text }]} numberOfLines={1}>{item.filename}</Text>
                    </View>
                    <Text style={[styles.docDesc, { color: colors.textMuted }]}>{item.description}</Text>
                    <View style={styles.docFooter}>
                      <Text style={[styles.docMeta, { color: colors.textMuted }]}>Завантажено: {item.upload_date}</Text>
                      <Button title="Скачати" onPress={() => handleDownloadDoc(item)} style={styles.docDlBtn} textStyle={{ fontSize: 12 }} />
                    </View>
                  </Card>
                )}
              />
            ) : (
              <View style={styles.center}>
                <FolderOpen size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: 12 }]}>Документів у цій категорії не знайдено.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 2. SECURITY MODAL OVERLAY */}
      {/* ========================================================================= */}
      <Modal visible={activeModal === 'security'} animationType="slide" transparent={true} onRequestClose={closeSecurity}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalOverlayHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Інтеграція Систем Безпеки</Text>
            <Pressable style={styles.closeBtn} onPress={closeSecurity}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={[styles.modalBody, { backgroundColor: colors.background }]}>
            {loadingSecurity ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                
                {/* Live stream preview mock */}
                {selectedCamera && (
                  <View style={styles.cctvContainer}>
                    <View style={styles.cctvPlaceholder}>
                      <Camera size={36} color="#666" style={{ marginBottom: 12 }} />
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{selectedCamera.name}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Симульований відеопотік</Text>
                      
                      {/* Live flashing tag */}
                      <View style={styles.liveTag}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveTagText}>● LIVE</Text>
                      </View>
                      <Text style={styles.liveClock}>{liveTime}</Text>
                    </View>
                  </View>
                )}

                {/* Cameras grid switcher */}
                <Text style={[styles.subSectionTitle, { color: colors.text, marginTop: 16 }]}>Камери спостереження</Text>
                <View style={styles.cameraSelectorGrid}>
                  {securityDevices.filter(d => d.device_type === 'camera').map((cam) => {
                    const isActive = selectedCamera?.id === cam.id;
                    return (
                      <Pressable key={cam.id} style={[styles.cameraPill, isActive && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setSelectedCamera(cam)}>
                        <Camera size={14} color={isActive ? '#fff' : colors.textMuted} />
                        <Text style={[styles.cameraPillText, { color: isActive ? '#fff' : colors.text }]}>{cam.name.replace("Камера ", "")}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Unlock controller list */}
                <Text style={[styles.subSectionTitle, { color: colors.text, marginTop: 24 }]}>Керування доступом</Text>
                {securityDevices.filter(d => d.device_type === 'door' || d.device_type === 'barrier').map((device) => {
                  const isUnlocking = unlockingDeviceId === device.id;
                  return (
                    <Card key={device.id} style={styles.securityCardItem}>
                      <View style={{ flex: 1, marginRight: 16 }}>
                        <Text style={[styles.secDeviceName, { color: colors.text }]}>{device.name}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                          {device.device_type === 'barrier' ? 'В\'їзний шлагбаум' : 'Замок під\'їзних дверей'}
                        </Text>
                      </View>
                      
                      <Button
                        title={isUnlocking ? `Відчинення (${unlockingCountdown}с)...` : "ВІДЧИНИТИ"}
                        onPress={() => handleUnlockDevice(device)}
                        disabled={unlockingDeviceId !== null}
                        style={[styles.secUnlockBtn, isUnlocking && { backgroundColor: colors.success }]}
                        textStyle={{ fontSize: 13, fontWeight: '800' }}
                      />
                    </Card>
                  );
                })}

              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. BOOKINGS MODAL OVERLAY */}
      {/* ========================================================================= */}
      <Modal visible={activeModal === 'bookings'} animationType="slide" transparent={true} onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalOverlayHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Зони відпочинку ОСББ</Text>
            <Pressable style={styles.closeBtn} onPress={() => setActiveModal(null)}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={[styles.modalBody, { backgroundColor: colors.background }]}>
            <View style={styles.tabHeader}>
              <Pressable style={[styles.tabButton, bookingTab === 'book' && { borderBottomColor: colors.primary }]} onPress={() => setBookingTab('book')}>
                <Text style={[styles.tabButtonText, { color: bookingTab === 'book' ? colors.primary : colors.textMuted }]}>Забронювати</Text>
              </Pressable>
              <Pressable style={[styles.tabButton, bookingTab === 'my' && { borderBottomColor: colors.primary }]} onPress={() => setBookingTab('my')}>
                <Text style={[styles.tabButtonText, { color: bookingTab === 'my' ? colors.primary : colors.textMuted }]}>Мої бронювання</Text>
              </Pressable>
            </View>

            {loadingBookings ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : bookingTab === 'book' ? (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                
                {/* List zones */}
                {recreationZones.map((zone) => (
                  <Card key={zone.id} style={[styles.zoneCard, selectedZone?.id === zone.id && { borderColor: colors.primary, borderWidth: 1.5 }]}>
                    <Text style={[styles.zoneName, { color: colors.text }]}>{zone.name}</Text>
                    <Text style={[styles.zoneDesc, { color: colors.textMuted }]}>{zone.description}</Text>
                    <View style={styles.zoneMetaRow}>
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>Місткість: {zone.capacity} чол.</Text>
                      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>{zone.price_per_hour} грн / година</Text>
                    </View>
                    <Button title={selectedZone?.id === zone.id ? "ОБРАНО" : "ОБРАТИ"} onPress={() => setSelectedZone(zone)} variant={selectedZone?.id === zone.id ? "primary" : "outline"} style={{ marginTop: 12 }} />
                  </Card>
                ))}

                {/* Booking form */}
                {selectedZone && (
                  <Card style={styles.bookingFormCard}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Бронювання: {selectedZone.name}</Text>
                    
                    <Text style={[styles.formLabel, { color: colors.textMuted }]}>Дата бронювання (РРРР-ММ-ДД)</Text>
                    <TextInput style={[styles.formInput, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.inputBg }]} value={bookingDate} onChangeText={setBookingDate} placeholder="2026-06-23" placeholderTextColor="#666" />
                    
                    <View style={styles.formRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.formLabel, { color: colors.textMuted }]}>Час початку (ГГ:ХХ)</Text>
                        <TextInput style={[styles.formInput, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.inputBg }]} value={bookingStart} onChangeText={setBookingStart} placeholder="12:00" placeholderTextColor="#666" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.formLabel, { color: colors.textMuted }]}>Час закінчення (ГГ:ХХ)</Text>
                        <TextInput style={[styles.formInput, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.inputBg }]} value={bookingEnd} onChangeText={setBookingEnd} placeholder="14:00" placeholderTextColor="#666" />
                      </View>
                    </View>

                    <Button title={submittingBooking ? "Надсилання..." : "ПІДТВЕРДИТИ БРОНЮВАННЯ"} onPress={handleCreateBooking} disabled={submittingBooking} style={{ marginTop: 16 }} />
                  </Card>
                )}

              </ScrollView>
            ) : (
              /* My Bookings tab */
              <FlatList
                data={myBookings}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <Card style={styles.bookingRecordCard}>
                    <View style={styles.recordHeader}>
                      <Text style={[styles.recordZoneName, { color: colors.text }]}>{item.zone_name}</Text>
                      <Text style={[styles.statusBadge, item.status === 'cancelled' ? { color: colors.error } : { color: colors.success }]}>
                        {item.status === 'cancelled' ? 'Скасовано' : 'Підтверджено'}
                      </Text>
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                      Дата: {item.booking_date} • Час: {item.start_time} - {item.end_time}
                    </Text>
                    <View style={styles.recordFooter}>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>Вартість: {item.total_price} грн</Text>
                      {item.status !== 'cancelled' && (
                        <Pressable onPress={() => handleCancelBooking(item.id)}>
                          <Text style={{ color: colors.error, fontSize: 13, fontWeight: '600' }}>Скасувати</Text>
                        </Pressable>
                      )}
                    </View>
                  </Card>
                )}
                ListEmptyComponent={
                  <View style={styles.center}>
                    <CalendarIcon size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: 12 }]}>У вас немає активних бронювань.</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 4. SERVICES MODAL OVERLAY */}
      {/* ========================================================================= */}
      <Modal visible={activeModal === 'services'} animationType="slide" transparent={true} onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalOverlayHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Замовлення послуг</Text>
            <Pressable style={styles.closeBtn} onPress={() => setActiveModal(null)}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={[styles.modalBody, { backgroundColor: colors.background }]}>
            {loadingServices ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                
                {/* Create Order Form */}
                <Card style={styles.serviceFormCard}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Нове замовлення майстра</Text>
                  
                  <Text style={[styles.formLabel, { color: colors.textMuted }]}>Тип послуги</Text>
                  <View style={styles.typeSelectorRow}>
                    {(['cleaning', 'plumbing', 'electrical', 'repair'] as const).map((type) => {
                      const active = serviceType === type;
                      const label = type === 'cleaning' ? 'Клінінг' : type === 'plumbing' ? 'Сантехнік' : type === 'electrical' ? 'Електрик' : 'Майстер';
                      return (
                        <Pressable key={type} style={[styles.typePill, active && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setServiceType(type)}>
                          <Text style={[styles.typePillText, { color: active ? '#fff' : colors.text }]}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.formLabel, { color: colors.textMuted, marginTop: 12 }]}>Опис проблеми (що потрібно виконати?)</Text>
                  <TextInput
                    style={[styles.formTextarea, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.inputBg }]}
                    value={serviceDesc}
                    onChangeText={setServiceDesc}
                    placeholder="Опишіть деталі заявки..."
                    placeholderTextColor="#666"
                    multiline
                    numberOfLines={4}
                  />

                  <Text style={[styles.formLabel, { color: colors.textMuted, marginTop: 12 }]}>Бажаний час виконання</Text>
                  <TextInput style={[styles.formInput, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.inputBg }]} value={servicePreferredTime} onChangeText={setServicePreferredTime} placeholder="Завтра з 10:00" placeholderTextColor="#666" />

                  <Button title={submittingService ? "Створення..." : "ЗАМОВИТИ ПОСЛУГУ"} onPress={handleCreateServiceOrder} disabled={submittingService} style={{ marginTop: 16 }} />
                </Card>

                {/* My Service Orders list */}
                <Text style={[styles.subSectionTitle, { color: colors.text, marginTop: 24, marginBottom: 12 }]}>Історія замовлень</Text>
                {myServices.length > 0 ? (
                  myServices.map((item) => (
                    <Card key={item.id} style={styles.serviceItemCard}>
                      <View style={styles.recordHeader}>
                        <Text style={[styles.serviceTypeName, { color: colors.text }]}>
                          {item.service_type === 'cleaning' ? '🧹 Клінінг' : item.service_type === 'plumbing' ? '🚰 Сантехнічні роботи' : item.service_type === 'electrical' ? '⚡ Електромонтаж' : '🔧 Загальний ремонт'}
                        </Text>
                        <Text style={[styles.statusBadge, { color: colors.primary }]}>{item.status === 'new' ? 'Нова' : 'Виконується'}</Text>
                      </View>
                      <Text style={{ color: colors.text, fontSize: 13, marginTop: 4 }}>{item.description}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Призначено: {item.contractor_name || 'Очікує призначення'}</Text>
                      <View style={styles.recordFooter}>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>Створено: {new Date(item.created_at).toLocaleDateString()}</Text>
                        <Text style={{ color: colors.success, fontWeight: '700' }}>{item.price} грн (попередня ціна)</Text>
                      </View>
                    </Card>
                  ))
                ) : (
                  <View style={styles.center}>
                    <Wrench size={36} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: 12 }]}>У вас немає замовлених послуг.</Text>
                  </View>
                )}

              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 5. SMART HOME MODAL OVERLAY */}
      {/* ========================================================================= */}
      <Modal visible={activeModal === 'smart_home'} animationType="slide" transparent={true} onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalOverlayHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Розумний Дім & Авто-лічильники</Text>
            <Pressable style={styles.closeBtn} onPress={() => setActiveModal(null)}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={[styles.modalBody, { backgroundColor: colors.background }]}>
            {loadingSmart ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                
                {/* 1. Heating control card */}
                {heatingDevice && (
                  <Card style={[styles.thermostatCard, heatingDevice.status === 'heating' ? { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)' } : { backgroundColor: colors.card }]}>
                    <View style={styles.thermostatHeader}>
                      <Thermometer size={24} color={heatingDevice.status === 'heating' ? '#ef4444' : colors.primary} />
                      <Text style={[styles.thermostatTitle, { color: colors.text }]}>Розумна термостатична головка</Text>
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>Приміщення: {heatingDevice.room_name}</Text>
                    
                    {/* Ring control */}
                    <View style={styles.thermostatDialContainer}>
                      <Text style={[styles.thermostatCurrentTemp, { color: colors.textMuted }]}>
                        Поточна t°: {heatingDevice.current_temperature}°C
                      </Text>
                      <View style={styles.dialRow}>
                        <Pressable style={styles.dialBtn} onPress={() => handleTargetTempChange(-0.5)}>
                          <Minus size={24} color={colors.text} />
                        </Pressable>
                        <Text style={[styles.dialTempText, { color: colors.text }]}>{heatingDevice.target_temperature.toFixed(1)}°C</Text>
                        <Pressable style={styles.dialBtn} onPress={() => handleTargetTempChange(0.5)}>
                          <Plus size={24} color={colors.text} />
                        </Pressable>
                      </View>
                      <Text style={[styles.thermostatStatus, heatingDevice.status === 'heating' ? { color: '#ef4444' } : { color: colors.textMuted }]}>
                        Статус: {heatingDevice.status === 'heating' ? '🔥 Опалення активне' : '❄️ В очікуванні'}
                      </Text>
                    </View>

                    {/* Mode selection row */}
                    <View style={styles.heatingModeRow}>
                      {(['eco', 'comfort', 'schedule', 'off'] as const).map((mode) => {
                        const active = heatingDevice.mode === mode;
                        const label = mode === 'eco' ? 'Eco' : mode === 'comfort' ? 'Comfort' : mode === 'schedule' ? 'Розклад' : 'Вимк';
                        return (
                          <Pressable key={mode} style={[styles.modeBtn, active && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => handleHeatingModeChange(mode)}>
                            <Text style={[styles.modeBtnText, { color: active ? '#fff' : colors.text }]}>{label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Card>
                )}

                {/* 2. Auto-transmitting meters section */}
                <View style={styles.smartMetersHeader}>
                  <Text style={[styles.subSectionTitle, { color: colors.text, flex: 1 }]}>Телеметрія Розумних Лічильників</Text>
                  <Button title={syncingSmartMeters ? "Оновлення..." : "Синхронізувати"} onPress={handleSyncSmartMeters} disabled={syncingSmartMeters} style={styles.syncBtn} textStyle={{ fontSize: 11 }} />
                </View>

                {smartMeters.map((meter, index) => (
                  <Card key={index} style={styles.smartMeterCard}>
                    <View style={styles.recordHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Wifi size={18} color={colors.success} style={{ marginRight: 8 }} />
                        <Text style={[styles.smartMeterName, { color: colors.text }]}>{meter.meter_name}</Text>
                      </View>
                      <View style={styles.onlineBadge}>
                        <Text style={styles.onlineText}>{meter.smart_device_status.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Модель: {meter.smart_device_model}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>Останній замір: {new Date(meter.last_sync_at).toLocaleString('uk-UA')}</Text>
                    
                    {/* Last transmitted readings list */}
                    <Text style={[styles.smartReadingsHeader, { color: colors.text }]}>Історія авто-передач:</Text>
                    {meter.readings && meter.readings.length > 0 ? (
                      meter.readings.map((r: any, rIdx: number) => (
                        <View key={rIdx} style={styles.smartReadingRow}>
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{r.reading_date}</Text>
                          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{r.reading_value} {meter.meter_type === 'water' ? 'м³' : meter.meter_type === 'electricity' ? 'кВт·год' : 'од'}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Немає записаних передач.</Text>
                    )}
                  </Card>
                ))}

              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 6. CONTACTS MODAL OVERLAY */}
      {/* ========================================================================= */}
      <Modal visible={activeModal === 'contacts'} animationType="slide" transparent={true} onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalOverlayHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Важливі контакти ОСББ</Text>
            <Pressable style={styles.closeBtn} onPress={() => setActiveModal(null)}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={[styles.modalBody, { backgroundColor: colors.background }]}>
            {loadingContacts ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : contacts.length > 0 ? (
              <FlatList
                data={contacts}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <Card style={styles.contactItemCard}>
                    <View style={styles.contactHeaderRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.contactRole, { color: colors.primary }]}>{item.role}</Text>
                      </View>
                      <Pressable 
                        style={[styles.callBtnCircle, { backgroundColor: colors.primaryMuted }]}
                        onPress={() => handleCallPhone(item.phone)}
                      >
                        <Phone size={18} color={colors.primary} />
                      </Pressable>
                    </View>
                    <Pressable style={styles.phonePressable} onPress={() => handleCallPhone(item.phone)}>
                      <Text style={[styles.contactPhone, { color: colors.textMuted }]}>{item.phone}</Text>
                    </Pressable>
                  </Card>
                )}
              />
            ) : (
              <View style={styles.center}>
                <Phone size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: 12 }]}>Контактів не знайдено.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. BOARD OF DIRECTORS MODAL OVERLAY */}
      {/* ========================================================================= */}
      <Modal visible={activeModal === 'board'} animationType="slide" transparent={true} onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalOverlayHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>🏛️ Робочий простір правління</Text>
            <Pressable style={styles.closeBtn} onPress={() => setActiveModal(null)}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={[styles.modalBody, { backgroundColor: colors.background, padding: 16 }]}>
            {/* Create Issue Toggle & Form */}
            {data?.member?.is_board_chairman && (
              <View style={{ marginBottom: 16 }}>
                {!isCreatingIssue ? (
                  <Button
                    title="➕ Створити питання"
                    onPress={() => setIsCreatingIssue(true)}
                    style={{ backgroundColor: colors.primary }}
                  />
                ) : (
                  <Card style={{ padding: 16, borderColor: colors.primary, borderWidth: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>Нове питання на порядок денний</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border, padding: 10, borderWidth: 1, borderRadius: 10, marginBottom: 8 }]}
                      placeholder="Тема питання"
                      placeholderTextColor={colors.textMuted}
                      value={newIssueTitle}
                      onChangeText={setNewIssueTitle}
                    />
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border, padding: 10, borderWidth: 1, borderRadius: 10, minHeight: 60, marginBottom: 12 }]}
                      placeholder="Опис пропозиції..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      value={newIssueDesc}
                      onChangeText={setNewIssueDesc}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button title="Зберегти" onPress={handleCreateIssue} style={{ flex: 1, backgroundColor: colors.primary }} />
                      <Button title="Скасувати" onPress={() => { setIsCreatingIssue(false); setNewIssueTitle(''); setNewIssueDesc(''); }} style={{ flex: 1, backgroundColor: 'grey' }} />
                    </View>
                  </Card>
                )}
              </View>
            )}

            {loadingBoard ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : boardIssues.length > 0 ? (
              <FlatList
                data={boardIssues}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingBottom: 24 }}
                renderItem={({ item }) => {
                  const hasVoted = !!item.my_vote;
                  return (
                    <Card style={{ padding: 16, marginBottom: 12, borderWidth: 1.2, borderColor: colors.border }}>
                      {/* Status Badges */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{
                          backgroundColor: item.status === 'discussion' ? 'rgba(59, 130, 246, 0.1)' : item.status === 'voting' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6
                        }}>
                          <Text style={{
                            fontSize: 10, fontWeight: 'bold',
                            color: item.status === 'discussion' ? '#3b82f6' : item.status === 'voting' ? '#f59e0b' : '#10b981'
                          }}>
                            {item.status === 'discussion' ? 'Обговорення' : item.status === 'voting' ? 'Голосування' : item.is_signed ? 'Підписано КЕП' : 'Завершено'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 10, color: colors.textMuted }}>
                          {new Date(item.created_at).toLocaleDateString('uk-UA')}
                        </Text>
                      </View>

                      {/* Title & Desc */}
                      <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text }}>{item.title}</Text>
                      {item.description ? (
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{item.description}</Text>
                      ) : null}

                      {/* Voting Controls (Voting status) */}
                      {item.status === 'voting' && (
                        <View style={{ marginTop: 12, backgroundColor: 'rgba(245, 158, 11, 0.05)', padding: 12, borderRadius: 10 }}>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#f59e0b', marginBottom: 6 }}>Ваше рішення по питанню:</Text>
                          {hasVoted ? (
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 8 }}>
                              <Text style={{ fontSize: 12, color: colors.text, fontWeight: 'bold' }}>
                                Ваш голос: {item.my_vote.vote_value === 'yes' ? 'За ✅' : item.my_vote.vote_value === 'no' ? 'Проти ❌' : 'Утримався 👤'}
                              </Text>
                              {item.my_vote.comment ? (
                                <Text style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginTop: 4 }}>
                                  Коментар: "{item.my_vote.comment}"
                                </Text>
                              ) : null}
                            </View>
                          ) : (
                            <View style={{ gap: 8 }}>
                              <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, padding: 8, borderWidth: 1, borderRadius: 8, fontSize: 11 }]}
                                placeholder="Ваш коментар (опціонально)..."
                                placeholderTextColor={colors.textMuted}
                                value={voteComments[item.id] || ''}
                                onChangeText={(text) => setVoteComments({ ...voteComments, [item.id]: text })}
                              />
                              <View style={{ flexDirection: 'row', gap: 6 }}>
                                <Pressable
                                  style={{ flex: 1, backgroundColor: '#10b981', padding: 8, borderRadius: 8, alignItems: 'center' }}
                                  onPress={() => handleVote(item.id, 'yes')}
                                >
                                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>ЗА</Text>
                                </Pressable>
                                <Pressable
                                  style={{ flex: 1, backgroundColor: '#ef4444', padding: 8, borderRadius: 8, alignItems: 'center' }}
                                  onPress={() => handleVote(item.id, 'no')}
                                >
                                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>ПРОТИ</Text>
                                </Pressable>
                                <Pressable
                                  style={{ flex: 1, backgroundColor: '#6b7280', padding: 8, borderRadius: 8, alignItems: 'center' }}
                                  onPress={() => handleVote(item.id, 'abstain')}
                                >
                                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Утрим.</Text>
                                </Pressable>
                              </View>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Vote statistics (if not in discussion status) */}
                      {item.status !== 'discussion' && (
                        <View style={{ marginTop: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 10, color: colors.textMuted }}>Результати:</Text>
                            <Text style={{ fontSize: 10, color: colors.textMuted }}>Всього: {item.stats.total}</Text>
                          </View>
                          <Text style={{ fontSize: 11, color: colors.text, fontWeight: 'bold' }}>
                            За: <Text style={{ color: '#10b981' }}>{item.stats.yes}</Text> | Проти: <Text style={{ color: '#ef4444' }}>{item.stats.no}</Text> | Утрималися: <Text style={{ color: '#6b7280' }}>{item.stats.abstain}</Text>
                          </Text>
                          
                          {/* Detailed comments list */}
                          {item.detailed_votes && item.detailed_votes.length > 0 && (
                            <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 6 }}>
                              {item.detailed_votes.map((dv: any, idx: number) => (
                                <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}>
                                  <Text style={{ fontSize: 10, color: colors.text }} numberOfLines={1}>
                                    • {dv.member_name} {dv.comment ? `("${dv.comment}")` : ''}
                                  </Text>
                                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: dv.vote_value === 'yes' ? '#10b981' : dv.vote_value === 'no' ? '#ef4444' : '#6b7280' }}>
                                    {dv.vote_value === 'yes' ? 'ЗА' : dv.vote_value === 'no' ? 'ПРОТИ' : 'УТРИМ.'}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}

                      {/* AI Minutes Protocol (Completed status) */}
                      {item.status === 'completed' && item.ai_protocol && (
                        <View style={{ marginTop: 12 }}>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.primary, marginBottom: 4 }}>🤖 Протокол засідання (ШІ):</Text>
                          <View style={{ height: 120, backgroundColor: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                            <ScrollView nestedScrollEnabled>
                              <Text style={{ fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: colors.text }}>{item.ai_protocol}</Text>
                            </ScrollView>
                          </View>
                          {item.is_signed && (
                            <View style={{ marginTop: 6, backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: 8, borderRadius: 8 }}>
                              <Text style={{ fontSize: 10, color: '#10b981', fontWeight: 'bold' }}>✍️ {item.signature_text}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Signing block (inline) */}
                      {isSigningIssueId === item.id && (
                        <View style={{ marginTop: 12, padding: 12, backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: 10, borderWidth: 1, borderColor: colors.primary }}>
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>✍️ Накласти цифровий підпис КЕП</Text>
                          
                          {certificates.length > 0 ? (
                            <View style={{ gap: 6, marginBottom: 8 }}>
                              <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: 'bold' }}>Оберіть КЕП Сертифікат:</Text>
                              {certificates.map((cert) => (
                                <Pressable
                                  key={cert.id}
                                  style={{
                                    padding: 8, borderRadius: 8, borderWidth: 1.2,
                                    borderColor: signCertId === cert.id ? colors.primary : colors.border,
                                    backgroundColor: signCertId === cert.id ? 'rgba(99, 102, 241, 0.08)' : 'transparent'
                                  }}
                                  onPress={() => setSignCertId(cert.id)}
                                >
                                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text }}>{cert.cert_owner_name}</Text>
                                  <Text style={{ fontSize: 8, color: colors.textMuted }}>{cert.cert_issuer} (№ {cert.cert_serial.slice(0,8)}...)</Text>
                                </Pressable>
                              ))}
                            </View>
                          ) : (
                            <Text style={{ fontSize: 9, color: colors.textMuted, marginBottom: 8 }}>Буде застосовано ЕЦП Голови правління.</Text>
                          )}

                          {signCertId && (
                            <TextInput
                              secureTextEntry
                              style={[styles.input, { color: colors.text, borderColor: colors.border, padding: 8, borderWidth: 1, borderRadius: 8, fontSize: 11, marginBottom: 8 }]}
                              placeholder="Введіть пароль ключа..."
                              placeholderTextColor={colors.textMuted}
                              value={signPassword}
                              onChangeText={setSignPassword}
                            />
                          )}

                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <Button title="Підтвердити" onPress={handleSignProtocol} style={{ flex: 1, backgroundColor: colors.primary }} textStyle={{ fontSize: 11 }} />
                            <Button title="Скасувати" onPress={() => { setIsSigningIssueId(null); setSignCertId(null); setSignPassword(''); }} style={{ flex: 1, backgroundColor: 'grey' }} textStyle={{ fontSize: 11 }} />
                          </View>
                        </View>
                      )}

                      {/* Chairman Buttons */}
                      {data?.member?.is_board_chairman && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: 10 }}>
                          {item.status === 'discussion' && (
                            <Button title="▶️ Запустити голосування" onPress={() => handleStartVoting(item.id)} style={{ flex: 1, backgroundColor: '#f59e0b' }} textStyle={{ fontSize: 11 }} />
                          )}
                          {item.status === 'voting' && (
                            <Button title="⏹️ Завершити голосування" onPress={() => handleEndVoting(item.id)} style={{ flex: 1, backgroundColor: '#10b981' }} textStyle={{ fontSize: 11 }} />
                          )}
                          {item.status === 'completed' && !item.is_signed && !isSigningIssueId && (
                            <Button title="✍️ Накласти КЕП" onPress={() => setIsSigningIssueId(item.id)} style={{ flex: 1, backgroundColor: colors.primary }} textStyle={{ fontSize: 11 }} />
                          )}
                        </View>
                      )}
                    </Card>
                  );
                }}
              />
            ) : (
              <View style={styles.center}>
                <FolderOpen size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: 12 }]}>Немає створених питань правління.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  mainContent: {
    padding: 16,
  },
  headerBanner: {
    width: '100%',
    height: 180,
    justifyContent: 'flex-end',
  },
  headerBannerImage: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  floatingOrgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  floatingOrgIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingOrgName: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    lineHeight: 16,
  },
  floatingOrgSub: {
    fontSize: 10,
    marginTop: 2,
  },
  propertyInfoCard: {
    padding: 16,
    marginBottom: 12,
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  propertyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertyLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  propertyValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  accountNumberText: {
    fontSize: 11,
    marginTop: 2,
  },
  ownerBadge: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  ownerName: {
    fontSize: 12,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  profileCard: {
    padding: 16,
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: 16,
    opacity: 0.8,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  flatText: {
    fontSize: 14,
    marginTop: 4,
  },
  orgText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  balanceCard: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  balanceText: {
    fontSize: 26,
    fontWeight: '700',
    marginVertical: 10,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subLabel: {
    fontSize: 13,
    marginBottom: 16,
  },
  duesDebtAlert: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  duesDebtAlertText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  payBtn: {
    flex: 1,
  },
  receiptBtn: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 16,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  gridContainer: {
    gap: 12,
    marginBottom: 20,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridItem: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
  },
  gridItemFull: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  fullRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  gridSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  meterCard: {
    padding: 16,
    marginBottom: 12,
  },
  meterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  meterInfo: {
    flex: 1,
  },
  meterName: {
    fontSize: 15,
    fontWeight: '700',
  },
  meterPrev: {
    fontSize: 13,
    marginTop: 4,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(120,120,128,0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  lockText: {
    fontSize: 11,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  submitButton: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  lockedPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.08)',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  lockedPlaceholderText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  reminderCard: {
    padding: 16,
    marginBottom: 12,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  reminderDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  reminderButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  reminderBtn: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 6,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },

  // Modal Overlays
  modalContainer: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 50 : 30,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  modalOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },

  // Documents
  filterScroll: {
    maxHeight: 50,
    marginVertical: 8,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  docItemCard: {
    padding: 14,
    marginBottom: 10,
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docFilename: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  docDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  docFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  docMeta: {
    fontSize: 11,
  },
  docDlBtn: {
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  // Security CCTV
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  cctvContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cctvPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  liveTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(239,68,68,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  liveClock: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    color: '#fff',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  cameraSelectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  cameraPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: 6,
  },
  cameraPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  securityCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
  },
  secDeviceName: {
    fontSize: 14,
    fontWeight: '700',
  },
  secUnlockBtn: {
    minWidth: 110,
    minHeight: 36,
    paddingVertical: 6,
  },

  // Recreation Zone Booking
  tabHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  zoneCard: {
    padding: 16,
    marginBottom: 12,
  },
  zoneName: {
    fontSize: 15,
    fontWeight: '700',
  },
  zoneDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  zoneMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  bookingFormCard: {
    padding: 16,
    marginTop: 12,
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
  },
  bookingRecordCard: {
    padding: 14,
    marginBottom: 10,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordZoneName: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  recordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 8,
  },

  // Service ordering
  serviceFormCard: {
    padding: 16,
    marginBottom: 16,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formTextarea: {
    height: 80,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  serviceItemCard: {
    padding: 14,
    marginBottom: 10,
  },
  serviceTypeName: {
    fontSize: 14,
    fontWeight: '700',
  },
  recordFooterText: {
    fontSize: 11,
  },

  // Smart Home
  thermostatCard: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  thermostatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  thermostatTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  thermostatDialContainer: {
    alignItems: 'center',
    marginVertical: 20,
    gap: 8,
  },
  thermostatCurrentTemp: {
    fontSize: 13,
  },
  dialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  dialBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialTempText: {
    fontSize: 32,
    fontWeight: '900',
  },
  thermostatStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  heatingModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modeBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  smartMetersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  syncBtn: {
    minHeight: 28,
    paddingHorizontal: 12,
  },
  smartMeterCard: {
    padding: 14,
    marginBottom: 10,
  },
  smartMeterName: {
    fontSize: 14,
    fontWeight: '700',
  },
  onlineBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  onlineText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '800',
  },
  smartReadingsHeader: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  smartReadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  contactItemCard: {
    padding: 16,
    marginBottom: 10,
  },
  contactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
  },
  contactRole: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  callBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phonePressable: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 8,
  },
  contactPhone: {
    fontSize: 14,
    fontWeight: '600',
  },
});
