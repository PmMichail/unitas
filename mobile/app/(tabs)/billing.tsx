import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  useWindowDimensions,
  Linking,
  AppState
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { api, ProfileData } from '../../services/api';
import { haptics } from '../../services/haptics';
import { useFocusEffect } from 'expo-router';
import {
  Plus,
  Trash2,
  Mail,
  CheckCircle2,
  Settings,
  Users,
  TrendingUp,
  X,
  FileText,
  Filter,
  AlertCircle,
  Briefcase,
  Coins
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Member {
  id: number;
  profile_id: number;
  identifier: string;
  owner_name?: string;
  area?: number;
  rate_per_sqm?: number;
  fixed_monthly_fee?: number;
  email?: string;
  phone?: string;
  balance: number;
  property_type?: string;
  parent_id?: number | null;
}

interface Transaction {
  id: number;
  date: string;
  amount: number;
  direction: string;
  purpose: string;
  contragent: string;
  type: string;
  taxable: boolean;
  transaction_type: string;
  profile_id: number;
  member_id?: number | null;
}

interface Meter {
  id: number;
  profile_id: number;
  name: string;
  type: string; // electricity, water, gas, heat
  parent_id?: number | null;
  parent_name?: string | null;
  member_id?: number | null;
  member_identifier?: string | null;
  tariff: number;
  initial_reading?: number;
  last_reading_value?: number;
  last_reading_date?: string | null;
}

import ResidentTickets from '../../components/resident/ResidentTickets';

export default function BillingScreen() {
  const { colors } = useTheme();
  const { telegramId, isResident } = useAuth();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  if (isResident) {
    return <ResidentTickets />;
  }

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const modalMaxHeight = Math.min(windowHeight * 0.85, windowHeight - keyboardHeight - 50);

  // Profile management
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);
  
  // Billing data
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'payments' | 'meters'>('members');
  
  // Modals
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  
  // Member Form fields
  const [identifier, setIdentifier] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [area, setArea] = useState('');
  const [ratePerSqm, setRatePerSqm] = useState('');
  const [fixedFee, setFixedFee] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [balance, setBalance] = useState('');
  const [propertyType, setPropertyType] = useState('кв.');
  const [parentId, setParentId] = useState<number>(-1);
  const [saving, setSaving] = useState(false);
  const [payingMono, setPayingMono] = useState(false);

  // Charge / Accrual Modal
  const [chargeModalVisible, setChargeModalVisible] = useState(false);
  const [chargeDescription, setChargeDescription] = useState('Щомісячний внесок за утримання будинку');
  const [chargeType, setChargeType] = useState('regular');
  const [periodType, setPeriodType] = useState('monthly');
  const [chargeMultiplier, setChargeMultiplier] = useState('1');
  const [chargeAmountOverride, setChargeAmountOverride] = useState('');
  const [chargeMemberId, setChargeMemberId] = useState<number>(-1);
  const [charging, setCharging] = useState(false);

  // Auto-matching progress
  const [matching, setMatching] = useState(false);

  // Selector Modals
  const [selectorModalVisible, setSelectorModalVisible] = useState(false);
  const [selectorType, setSelectorType] = useState<'parent' | 'charge_member' | 'payment_member' | 'meter_member' | 'meter_parent'>('parent');
  const [currentPaymentId, setCurrentPaymentId] = useState<number | null>(null);
  const [selectorSearch, setSelectorSearch] = useState('');

  // Meter Form fields
  const [meterModalVisible, setMeterModalVisible] = useState(false);
  const [editingMeter, setEditingMeter] = useState<Meter | null>(null);
  const [meterName, setMeterName] = useState('');
  const [meterType, setMeterType] = useState('water');
  const [meterParentId, setMeterParentId] = useState<number>(-1);
  const [meterMemberId, setMeterMemberId] = useState<number>(-1);
  const [meterTariff, setMeterTariff] = useState('');
  const [savingMeter, setSavingMeter] = useState(false);

  // Meter Reading Form fields
  const [readingModalVisible, setReadingModalVisible] = useState(false);
  const [selectedMeterForReading, setSelectedMeterForReading] = useState<Meter | null>(null);
  const [readingValue, setReadingValue] = useState('');
  const [savingReading, setSavingReading] = useState(false);
  const [readingDate, setReadingDate] = useState('');

  // Meter Initial Reading
  const [meterInitialReading, setMeterInitialReading] = useState('');

  // Member details card modal state
  const [memberDetailsModalVisible, setMemberDetailsModalVisible] = useState(false);
  const [selectedMemberDetails, setSelectedMemberDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsActiveTab, setDetailsActiveTab] = useState<'readings' | 'charges' | 'payments'>('readings');

  // Lock readings state
  const [lockMonth, setLockMonth] = useState<number>(new Date().getMonth() + 1);
  const [lockYear, setLockYear] = useState<number>(new Date().getFullYear());
  const [lockLoading, setLockLoading] = useState(false);

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
        
        if (activeProfile.tax_system === 'non_profit') {
          await fetchBillingData(activeProfile.id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити дані білінгу');
      setLoading(false);
    }
  };

  const fetchBillingData = async (profileId: number) => {
    try {
      const data = await api.getMembers(profileId);
      setMembers(data || []);

      const tx = await api.getTransactions(profileId);
      setTransactions(tx || []);

      const m = await api.getMeters(profileId);
      setMeters(m || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити списки');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedProfile) {
      if (selectedProfile.tax_system === 'non_profit') {
        await fetchBillingData(selectedProfile.id);
      } else {
        setRefreshing(false);
      }
    } else {
      await loadData();
    }
  };

  // Clickable contact dialing/messaging
  const handleContactPress = (phoneStr: string) => {
    haptics.light();
    Alert.alert(
      'Зв\'язок',
      `Оберіть дію для номера ${phoneStr}:`,
      [
        { text: 'Зателефонувати', onPress: () => Linking.openURL(`tel:${phoneStr}`) },
        { text: 'Надіслати SMS', onPress: () => Linking.openURL(`sms:${phoneStr}`) },
        { text: 'Скасувати', style: 'cancel' }
      ]
    );
  };

  // Add / Edit Member handlers
  const handleOpenAdd = () => {
    setEditingMember(null);
    setIdentifier('');
    setOwnerName('');
    setArea('');
    setRatePerSqm('');
    setFixedFee('');
    setEmail('');
    setPhone('');
    setBalance('0');
    setPropertyType('кв.');
    setParentId(-1);
    setMemberModalVisible(true);
  };

  const handleOpenEdit = (m: Member) => {
    setEditingMember(m);
    setIdentifier(m.identifier);
    setOwnerName(m.owner_name || '');
    setArea(m.area ? String(m.area) : '');
    setRatePerSqm(m.rate_per_sqm ? String(m.rate_per_sqm) : '');
    setFixedFee(m.fixed_monthly_fee ? String(m.fixed_monthly_fee) : '');
    setEmail(m.email || '');
    setPhone(m.phone || '');
    setBalance(m.balance ? String(m.balance) : '0');
    setPropertyType(m.property_type || 'кв.');
    setParentId(m.parent_id || -1);
    setMemberModalVisible(true);
  };

  const handleSaveMember = async () => {
    if (!selectedProfile) return;
    if (!identifier.trim()) {
      Alert.alert('Помилка', 'Будь ласка, вкажіть номер об\'єкта');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        identifier: identifier.trim(),
        owner_name: ownerName.trim() || undefined,
        area: area ? parseFloat(area) : 0,
        rate_per_sqm: ratePerSqm ? parseFloat(ratePerSqm) : 0,
        fixed_monthly_fee: fixedFee ? parseFloat(fixedFee) : 0,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        balance: balance ? parseFloat(balance) : 0,
        property_type: propertyType,
        parent_id: parentId !== -1 ? parentId : undefined
      };

      if (editingMember) {
        await api.updateMember(selectedProfile.id, editingMember.id, payload);
        haptics.success();
        Alert.alert('Успіх', 'Дані об\'єкта успішно оновлено!');
      } else {
        await api.createMember(selectedProfile.id, payload);
        haptics.success();
        Alert.alert('Успіх', 'Новий об\'єкт успішно додано!');
      }

      setMemberModalVisible(false);
      fetchBillingData(selectedProfile.id);
    } catch (e: any) {
      console.error(e);
      const errMsg = e.response?.data?.detail || 'Не вдалося зберегти об\'єкт';
      Alert.alert('Помилка збереження', errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = (member: Member) => {
    if (!selectedProfile) return;
    Alert.alert(
      'Видалення об\'єкта',
      `Ви впевнені, що хочете видалити об'єкт ${member.property_type || 'кв.'} ${member.identifier}?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await api.deleteMember(selectedProfile.id, member.id);
              haptics.success();
              Alert.alert('Успіх', 'Об\'єкт видалено');
              fetchBillingData(selectedProfile.id);
            } catch (e) {
              console.error(e);
              Alert.alert('Помилка', 'Не вдалося видалити об\'єкт');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Charge / Accrual Dues
  const handleChargeDues = async () => {
    if (!selectedProfile) return;
    setCharging(true);
    try {
      const payload: any = {
        description: chargeDescription,
        charge_type: chargeType,
        period_type: periodType,
        multiplier: parseFloat(chargeMultiplier) || 1.0,
      };
      if (chargeAmountOverride.trim() !== '') {
        payload.amount = parseFloat(chargeAmountOverride) || 0;
      }
      if (chargeMemberId !== -1) {
        payload.member_id = chargeMemberId;
      }

      const res = await api.chargeMembers(selectedProfile.id, payload);
      haptics.success();
      Alert.alert('Успіх', res.message || 'Нарахування проведено успішно!');
      setChargeModalVisible(false);
      fetchBillingData(selectedProfile.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося провести нарахування');
    } finally {
      setCharging(false);
    }
  };

  // Reconcile manual payment
  const handleManualReconcile = async (paymentId: number, memberId: number) => {
    if (!selectedProfile) return;
    try {
      const res = await api.reconcilePayment(selectedProfile.id, {
        payment_id: paymentId,
        member_id: memberId,
      });
      haptics.success();
      Alert.alert('Успіх', res.message || 'Платіж успішно проведено вручну!');
      fetchBillingData(selectedProfile.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося провести платіж вручну');
    }
  };

  // Auto-matching
  const handleAutoMatchPayments = async () => {
    if (!selectedProfile) return;
    setMatching(true);
    try {
      const res = await api.matchPayments(selectedProfile.id, {});
      haptics.success();
      Alert.alert(
        'Зіставлення платежів',
        `Успішно розпізнано ${res.matched_count || 0} платежів на суму ${(res.matched_amount || 0).toLocaleString('uk-UA')} ₴.`
      );
      fetchBillingData(selectedProfile.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося зіставити платежі');
    } finally {
      setMatching(false);
    }
  };

  // Meter management
  const handleOpenAddMeter = () => {
    setEditingMeter(null);
    setMeterName('');
    setMeterType('water');
    setMeterParentId(-1);
    setMeterMemberId(-1);
    setMeterTariff('');
    setMeterInitialReading('0');
    setMeterModalVisible(true);
  };

  const handleOpenEditMeter = (m: Meter) => {
    setEditingMeter(m);
    setMeterName(m.name);
    setMeterType(m.type);
    setMeterParentId(m.parent_id || -1);
    setMeterMemberId(m.member_id || -1);
    setMeterTariff(m.tariff ? String(m.tariff) : '');
    setMeterInitialReading(m.initial_reading !== undefined ? String(m.initial_reading) : '0');
    setMeterModalVisible(true);
  };

  const handleSaveMeter = async () => {
    if (!selectedProfile) return;
    if (!meterName.trim()) {
      Alert.alert('Помилка', 'Вкажіть назву лічильника');
      return;
    }
    setSavingMeter(true);
    try {
      const payload = {
        name: meterName.trim(),
        type: meterType,
        parent_id: meterParentId !== -1 ? meterParentId : undefined,
        member_id: meterMemberId !== -1 ? meterMemberId : undefined,
        tariff: meterTariff ? parseFloat(meterTariff) : 0,
        initial_reading: meterInitialReading ? parseFloat(meterInitialReading) : 0,
      };

      if (editingMeter) {
        await api.updateMeter(selectedProfile.id, editingMeter.id, payload);
        haptics.success();
        Alert.alert('Успіх', 'Лічильник оновлено!');
      } else {
        await api.createMeter(selectedProfile.id, payload);
        haptics.success();
        Alert.alert('Успіх', 'Лічильник успішно додано!');
      }
      setMeterModalVisible(false);
      fetchBillingData(selectedProfile.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося зберегти лічильник');
    } finally {
      setSavingMeter(false);
    }
  };

  const handleDeleteMeter = (meterId: number) => {
    if (!selectedProfile) return;
    Alert.alert(
      'Видалення лічильника',
      'Ви впевнені, що хочете видалити цей лічильник?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteMeter(selectedProfile.id, meterId);
              haptics.success();
              fetchBillingData(selectedProfile.id);
            } catch (e) {
              console.error(e);
              Alert.alert('Помилка', 'Не вдалося видалити лічильник');
            }
          }
        }
      ]
    );
  };

  const handleOpenReadingModal = (meter: Meter) => {
    setSelectedMeterForReading(meter);
    setReadingValue('');
    setReadingDate(new Date().toISOString().split('T')[0]);
    setReadingModalVisible(true);
  };

  const handleAddReading = async () => {
    if (!selectedProfile || !selectedMeterForReading) return;
    if (readingValue === '') {
      Alert.alert('Помилка', 'Вкажіть значення лічильника');
      return;
    }
    setSavingReading(true);
    try {
      await api.addMeterReading(selectedProfile.id, selectedMeterForReading.id, {
        reading_value: parseFloat(readingValue),
        reading_date: readingDate.trim() || undefined,
      });
      haptics.success();
      setReadingModalVisible(false);
      fetchBillingData(selectedProfile.id);
    } catch (e: any) {
      console.error(e);
      const errMsg = e.response?.data?.detail || 'Не вдалося зберегти показники';
      Alert.alert('Помилка', errMsg);
    } finally {
      setSavingReading(false);
    }
  };

  const handleLockReadings = async () => {
    if (!selectedProfile) return;
    setLockLoading(true);
    try {
      await api.lockReadings(selectedProfile.id, { month: lockMonth, year: lockYear });
      haptics.success();
      Alert.alert('Успіх', `Показники за ${lockMonth}/${lockYear} успішно зафіксовані.`);
      fetchBillingData(selectedProfile.id);
    } catch (e: any) {
      console.error(e);
      const errMsg = e.response?.data?.detail || 'Не вдалося зафіксувати показники';
      Alert.alert('Помилка', errMsg);
    } finally {
      setLockLoading(false);
    }
  };

  const handleDeleteMeterReading = async (meterId: number, readingId: number) => {
    if (!selectedProfile) return;
    Alert.alert(
      'Видалення показань',
      'Ви впевнені, що хочете видалити це показання? Це автоматично скасує нараховану суму за комунальні послуги та змінить баланс абонента.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteMeterReading(selectedProfile.id, meterId, readingId);
              haptics.success();
              Alert.alert('Успіх', 'Показники лічильника успішно видалено.');
              // Refresh details
              if (selectedMemberDetails?.member?.id) {
                const refreshed = await api.getMemberDetails(selectedProfile.id, selectedMemberDetails.member.id);
                setSelectedMemberDetails(refreshed);
              }
              fetchBillingData(selectedProfile.id);
            } catch (e: any) {
              console.error(e);
              const errMsg = e.response?.data?.detail || 'Не вдалося видалити показання';
              Alert.alert('Помилка', errMsg);
            }
          }
        }
      ]
    );
  };

  const handleOpenMemberDetails = async (memberId: number) => {
    if (!selectedProfile) return;
    haptics.light();
    setLoadingDetails(true);
    setSelectedMemberDetails(null);
    setDetailsActiveTab('readings');
    setMemberDetailsModalVisible(true);
    try {
      const data = await api.getMemberDetails(selectedProfile.id, memberId);
      setSelectedMemberDetails(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити картку абонента');
      setMemberDetailsModalVisible(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePayMonoInvoice = async (member: any) => {
    if (!selectedProfile) return;
    const amountToPay = Math.abs(member.balance);
    if (amountToPay <= 0) {
      Alert.alert('Увага', 'Баланс позитивний або нульовий');
      return;
    }
    setPayingMono(true);
    try {
      const res = await api.createMonoInvoice(selectedProfile.id, {
        member_id: member.id,
        amount: amountToPay,
        charge_type: 'regular',
        description: `Оплата заборгованості особового рахунку ${member.identifier}`
      });
      if (res.pageUrl) {
        await Linking.openURL(res.pageUrl);
      } else {
        Alert.alert('Помилка', 'Не вдалося отримати посилання на оплату');
      }
    } catch (e: any) {
      console.error(e);
      const errMsg = e.response?.data?.detail || 'Не вдалося створити рахунок Mono Pay';
      Alert.alert('Помилка', errMsg);
    } finally {
      setPayingMono(false);
    }
  };

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && selectedProfile && selectedMemberDetails?.member?.id) {
        api.getMemberDetails(selectedProfile.id, selectedMemberDetails.member.id)
          .then((data) => setSelectedMemberDetails(data))
          .catch((err) => console.log('Error refreshing member details:', err));
        
        fetchBillingData(selectedProfile.id);
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [selectedProfile?.id, selectedMemberDetails?.member?.id]);

  // Selector modal selection handler
  const handleSelectMember = (item: Member | null) => {
    if (selectorType === 'parent') {
      setParentId(item ? item.id : -1);
    } else if (selectorType === 'charge_member') {
      setChargeMemberId(item ? item.id : -1);
    } else if (selectorType === 'payment_member') {
      if (currentPaymentId !== null && item) {
        handleManualReconcile(currentPaymentId, item.id);
      }
    } else if (selectorType === 'meter_member') {
      setMeterMemberId(item ? item.id : -1);
    }
    setSelectorModalVisible(false);
  };

  const handleSelectParentMeter = (item: Meter | null) => {
    setMeterParentId(item ? item.id : -1);
    setSelectorModalVisible(false);
  };

  // Metrics
  const totalDebt = members
    .filter((m) => m.balance < 0)
    .reduce((sum, m) => sum + Math.abs(m.balance), 0);
  
  const totalPrepaid = members
    .filter((m) => m.balance > 0)
    .reduce((sum, m) => sum + m.balance, 0);

  const estimatedMonthlyAccruals = members.reduce((sum, m) => {
    if (m.rate_per_sqm && m.area) {
      return sum + m.rate_per_sqm * m.area;
    }
    return sum + (m.fixed_monthly_fee || 0);
  }, 0);

  // Search filter
  const filteredMembers = members.filter((m) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      m.identifier.toLowerCase().includes(searchLower) ||
      (m.owner_name && m.owner_name.toLowerCase().includes(searchLower)) ||
      (m.phone && m.phone.toLowerCase().includes(searchLower)) ||
      (m.property_type && m.property_type.toLowerCase().includes(searchLower))
    );
  });

  const getMemberIdentifier = (memberId?: number | null) => {
    if (!memberId) return null;
    const member = members.find((m) => m.id === memberId);
    return member ? `${member.property_type || 'кв.'} ${member.identifier}` : `ID: ${memberId}`;
  };

  // Render blocked profile
  if (selectedProfile?.is_blocked) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <AlertCircle size={64} color={colors.error} style={{ marginBottom: 20 }} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 12, textAlign: 'center' }}>
          Профіль заблоковано
        </Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
          {selectedProfile.block_reason || "Ваш профіль тимчасово заблоковано. Будь ласка, зверніться до підтримки."}
        </Text>
      </View>
    );
  }

  // Render Non-profit warning
  if (selectedProfile && selectedProfile.tax_system !== 'non_profit') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 32 }]}>
        <AlertCircle size={60} color={colors.warning} style={{ marginBottom: 20 }} />
        <Text style={[styles.nonProfitTitle, { color: colors.text }]}>Розділ для Неприбуткових</Text>
        <Text style={[styles.nonProfitDesc, { color: colors.textMuted }]}>
          Цей розділ доступний лише для неприбуткових організацій (ОСББ, СТ, ГО тощо).
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Tab Segment selector */}
      <View style={[styles.tabSegment, { borderBottomColor: colors.cardBorder, backgroundColor: colors.card }]}>
        <Pressable 
          onPress={() => setActiveTab('members')}
          style={[styles.segmentBtn, activeTab === 'members' && [styles.segmentBtnActive, { borderBottomColor: colors.primary }]]}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'members' ? colors.primary : colors.textMuted }]}>
            Мешканці ({members.length})
          </Text>
        </Pressable>
        <Pressable 
          onPress={() => setActiveTab('payments')}
          style={[styles.segmentBtn, activeTab === 'payments' && [styles.segmentBtnActive, { borderBottomColor: colors.primary }]]}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'payments' ? colors.primary : colors.textMuted }]}>
            Платежі ({transactions.filter(t => t.direction === 'in').length})
          </Text>
        </Pressable>
        <Pressable 
          onPress={() => setActiveTab('meters')}
          style={[styles.segmentBtn, activeTab === 'meters' && [styles.segmentBtnActive, { borderBottomColor: colors.primary }]]}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'meters' ? colors.primary : colors.textMuted }]}>
            Лічильники ({meters.length})
          </Text>
        </Pressable>
      </View>

      {/* Quick Action Bar */}
      <View style={[styles.actionBar, { borderBottomColor: colors.cardBorder, backgroundColor: colors.card }]}>
        {activeTab === 'members' && (
          <View style={styles.actionBtnRow}>
            <Pressable 
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={handleOpenAdd}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.actionBtnText}>Додати об'єкт</Text>
            </Pressable>

            <Pressable 
              style={[styles.actionBtn, { backgroundColor: colors.success }]}
              onPress={() => {
                setChargeDescription('Чергове нарахування внесків');
                setChargeType('regular');
                setPeriodType('monthly');
                setChargeMultiplier('1');
                setChargeAmountOverride('');
                setChargeMemberId(-1);
                setChargeModalVisible(true);
              }}
            >
              <FileText size={16} color="#ffffff" />
              <Text style={styles.actionBtnText}>Нарахувати</Text>
            </Pressable>

            <Pressable 
              style={[styles.actionBtn, { backgroundColor: colors.primaryMuted }]}
              onPress={handleAutoMatchPayments}
              disabled={matching}
            >
              <Coins size={14} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Зіставити</Text>
            </Pressable>
          </View>
        )}

        {activeTab === 'meters' && (
          <View style={styles.actionBtnRow}>
            <Pressable 
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={handleOpenAddMeter}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.actionBtnText}>Додати лічильник</Text>
            </Pressable>
          </View>
        )}

        {/* Stats view */}
        {activeTab === 'members' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
            <View style={[styles.statBadge, { backgroundColor: colors.errorMuted }]}>
              <Text style={[styles.statVal, { color: colors.error }]}> Борг: -{totalDebt.toLocaleString('uk-UA')} ₴</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: colors.successMuted }]}>
              <Text style={[styles.statVal, { color: colors.success }]}> Передплата: +{totalPrepaid.toLocaleString('uk-UA')} ₴</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: colors.primaryMuted }]}>
              <Text style={[styles.statVal, { color: colors.primary }]}> Нарахування: {estimatedMonthlyAccruals.toLocaleString('uk-UA')} ₴/міс</Text>
            </View>
          </ScrollView>
        )}

        {/* Search input */}
        {activeTab === 'members' && (
          <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
            <Filter size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Шукати об'єкт, власника..."
              placeholderTextColor={colors.textMuted + '80'}
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeTab === 'members' ? (
        filteredMembers.length === 0 ? (
          <View style={styles.center}>
            <Users size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Об'єктів не знайдено</Text>
          </View>
        ) : (
          <FlatList
            data={filteredMembers}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            renderItem={({ item }) => {
              const hasDebt = item.balance < 0;
              const hasPrepaid = item.balance > 0;
              const parentMember = item.parent_id ? members.find(p => p.id === item.parent_id) : null;
              return (
                <Card style={styles.memberCard}>
                  <View style={styles.cardHeader}>
                    <Pressable 
                      style={styles.memberTitleGroup}
                      onPress={() => handleOpenMemberDetails(item.id)}
                    >
                      <View style={[styles.memberAvatar, { backgroundColor: colors.primaryMuted }]}>
                        <Text style={[styles.avatarText, { color: colors.primary }]}>{item.property_type || 'кв.'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.memberIdentifier, { color: colors.text, textDecorationLine: 'underline' }]}>
                          {item.property_type || 'кв.'} {item.identifier}
                        </Text>
                        <Text style={[styles.memberName, { color: colors.textMuted }]}>
                          {item.owner_name || 'Власник не вказаний'}
                        </Text>
                        {parentMember && (
                          <Text style={[styles.parentLinkText, { color: colors.primary }]}>
                            🔗 Прив'язано до: {parentMember.property_type || 'кв.'} {parentMember.identifier}
                          </Text>
                        )}
                      </View>
                    </Pressable>

                    <View style={[styles.balanceBadge, {
                      backgroundColor: hasDebt ? colors.errorMuted : hasPrepaid ? colors.successMuted : colors.border
                    }]}>
                      <Text style={[styles.balanceText, {
                        color: hasDebt ? colors.error : hasPrepaid ? colors.success : colors.textMuted
                      }]}>
                        {item.balance > 0 ? '+' : ''}{item.balance.toLocaleString('uk-UA')} ₴
                      </Text>
                    </View>
                  </View>

                  {/* Sub info */}
                  <View style={styles.detailsRow}>
                    {item.area ? (
                      <Text style={[styles.detailText, { color: colors.textMuted }]}>
                        Площа: <Text style={{ color: colors.text, fontWeight: '600' }}>{item.area} м²</Text> ({item.rate_per_sqm} ₴/м²)
                      </Text>
                    ) : item.fixed_monthly_fee ? (
                      <Text style={[styles.detailText, { color: colors.textMuted }]}>
                        Внесок: <Text style={{ color: colors.text, fontWeight: '600' }}>{item.fixed_monthly_fee} ₴</Text> (фікс)
                      </Text>
                    ) : null}
                  </View>

                  {item.phone ? (
                    <Pressable onPress={() => handleContactPress(item.phone!)}>
                      <Text style={[styles.contactText, { color: colors.primary, fontWeight: '700' }]}>
                        📞 {item.phone} (набрати / SMS)
                      </Text>
                    </Pressable>
                  ) : null}

                  {/* Card Actions */}
                  <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder }]} />
                  <View style={styles.cardActions}>
                    <Pressable style={styles.iconAction} onPress={() => handleOpenEdit(item)}>
                      <Settings size={14} color={colors.text} />
                      <Text style={[styles.actionText, { color: colors.text }]}>Змінити</Text>
                    </Pressable>

                    <Pressable style={styles.iconAction} onPress={() => handleDeleteMember(item)}>
                      <Trash2 size={14} color={colors.error} />
                      <Text style={[styles.actionText, { color: colors.error }]}>Видалити</Text>
                    </Pressable>
                  </View>
                </Card>
              );
            }}
          />
        )
      ) : activeTab === 'payments' ? (
        transactions.filter(t => t.direction === 'in').length === 0 ? (
          <View style={styles.center}>
            <Coins size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Надходжень не знайдено</Text>
          </View>
        ) : (
          <FlatList
            data={transactions.filter(t => t.direction === 'in')}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            renderItem={({ item }) => {
              const matchedIdent = getMemberIdentifier(item.member_id);
              return (
                <Card style={styles.memberCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberIdentifier, { color: colors.text }]}>
                        {item.contragent || 'Невідомий платник'}
                      </Text>
                      <Text style={[styles.dateText, { color: colors.textMuted }]}>{item.date}</Text>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: colors.success }}>
                      +{item.amount.toLocaleString('uk-UA')} ₴
                    </Text>
                  </View>

                  <Text style={[styles.purposeText, { color: colors.textMuted }]}>
                    {item.purpose}
                  </Text>

                  <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder }]} />

                  <View style={styles.reconcileRow}>
                    {matchedIdent ? (
                      <Pressable 
                        style={[styles.balanceBadge, { backgroundColor: colors.successMuted }]}
                        onPress={() => item.member_id && handleOpenMemberDetails(item.member_id)}
                      >
                        <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' }}>
                          ✓ Проведено на: {matchedIdent}
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={styles.unmatchedRow}>
                        <Pressable 
                          style={[styles.selectMemberBtn, { borderColor: colors.primary }]}
                          onPress={() => {
                            setCurrentPaymentId(item.id);
                            setSelectorType('payment_member');
                            setSelectorModalVisible(true);
                          }}
                        >
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                            Обрати абонента
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </Card>
              );
            }}
          />
        )
      ) : (
        // Meters activeTab
        meters.length === 0 ? (
          <View style={styles.center}>
            <Briefcase size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Лічильники відсутні</Text>
          </View>
        ) : (
          <FlatList
            data={meters}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListHeaderComponent={
              <Card style={{ marginBottom: 16, padding: 16, backgroundColor: colors.card, borderColor: colors.cardBorder }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>
                  🔒 Фіксація показів за місяць
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>Місяць (1-12)</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={String(lockMonth)}
                      onChangeText={(v) => setLockMonth(parseInt(v) || 1)}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 8,
                        padding: 8,
                        color: colors.text,
                        fontSize: 14,
                        backgroundColor: colors.background,
                      }}
                    />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>Рік</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={String(lockYear)}
                      onChangeText={(v) => setLockYear(parseInt(v) || new Date().getFullYear())}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 8,
                        padding: 8,
                        color: colors.text,
                        fontSize: 14,
                        backgroundColor: colors.background,
                      }}
                    />
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      {
                        backgroundColor: pressed ? colors.primary + 'CC' : colors.primary,
                        borderRadius: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        marginTop: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }
                    ]}
                    onPress={handleLockReadings}
                    disabled={lockLoading}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                      {lockLoading ? '...' : 'Фіксувати'}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            }
            renderItem={({ item }) => {
              const currentVal = item.last_reading_value !== undefined && item.last_reading_value !== null 
                ? item.last_reading_value 
                : (item.initial_reading ?? 0);
              return (
                <Card style={styles.memberCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberIdentifier, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.dateText, { color: colors.textMuted }]}>
                        Тип: {item.type === 'electricity' ? '⚡ Електро' : item.type === 'water' ? '💧 Вода' : item.type === 'gas' ? '🔥 Gas' : '🌡️ Тепло'}
                      </Text>
                      {item.parent_name && (
                        <Text style={[styles.parentLinkText, { color: colors.primary }]}>
                          ↳ Підпорядкований: {item.parent_name}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: colors.text }}>
                        {currentVal}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textMuted }}>Останній показник</Text>
                    </View>
                  </View>
 
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      Початкові: <Text style={{ color: colors.text, fontWeight: '600' }}>{item.initial_reading ?? 0}</Text>
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      Поточні: <Text style={{ color: colors.text, fontWeight: '600' }}>{currentVal}</Text>
                    </Text>
                  </View>
 
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      Тариф: <Text style={{ color: colors.text, fontWeight: '700' }}>{item.tariff} ₴/од.</Text>
                    </Text>
                    {item.member_id && (
                      <Pressable onPress={() => item.member_id && handleOpenMemberDetails(item.member_id)}>
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                          Абонент: <Text style={{ color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' }}>{item.member_identifier}</Text>
                        </Text>
                      </Pressable>
                    )}
                  </View>
 
                  <View style={[styles.cardDivider, { backgroundColor: colors.cardBorder }]} />
 
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Pressable
                      style={[styles.actionBtnInline, { backgroundColor: colors.primary }]}
                      onPress={() => handleOpenReadingModal(item)}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Внести показник</Text>
                    </Pressable>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Pressable onPress={() => handleOpenEditMeter(item)} style={styles.iconActionSmall}>
                        <Settings size={14} color={colors.text} />
                      </Pressable>
                      <Pressable onPress={() => handleDeleteMeter(item.id)} style={styles.iconActionSmall}>
                        <Trash2 size={14} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                </Card>
              );
            }}
          />
        )
      )}

      {/* Add / Edit Member Modal */}
      {memberModalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={memberModalVisible}
          onRequestClose={() => setMemberModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setMemberModalVisible(false)} />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ width: '100%', justifyContent: 'flex-end' }}
              pointerEvents="box-none"
            >
              <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.cardBorder, maxHeight: modalMaxHeight }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {editingMember ? 'Редагувати об\'єкт' : 'Додати об\'єкт'}
                  </Text>
                  <Pressable onPress={() => setMemberModalVisible(false)} style={styles.closeBtn}>
                    <X size={24} color={colors.text} />
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.modalScroll}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Тип об'єкта *</Text>
                  <View style={styles.propertyTypeRow}>
                    {['кв.', 'дл.', 'п/м', 'провайдер', 'інше'].map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => setPropertyType(t)}
                        style={[styles.typeSelectBtn, { borderColor: colors.border }, propertyType === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: propertyType === t ? '#fff' : colors.text }}>
                          {t === 'кв.' ? 'Кв.' : t === 'дл.' ? 'Дл.' : t === 'п/м' ? 'П/М' : t === 'провайдер' ? 'Пров.' : 'Інше'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Input
                    label="Номер / назва об'єкта *"
                    placeholder="напр. 14 або ділянка 2"
                    value={identifier}
                    onChangeText={setIdentifier}
                  />

                  <Input
                    label="ПІБ власника / назва компанії"
                    placeholder="напр. Коваленко О.В."
                    value={ownerName}
                    onChangeText={setOwnerName}
                  />

                  {/* Parent object selector button */}
                  <Text style={[styles.inputLabel, { color: colors.textMuted, marginTop: 12 }]}>Прив'язати до головного об'єкта</Text>
                  <Pressable
                    style={[styles.selectBox, { borderColor: colors.border }]}
                    onPress={() => {
                      setSelectorType('parent');
                      setSelectorModalVisible(true);
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 14 }}>
                      {parentId !== -1 ? (getMemberIdentifier(parentId) || 'Обрано об\'єкт') : 'Немає (Самостійний об\'єкт)'}
                    </Text>
                  </Pressable>

                  <View style={styles.formRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Input
                        label="Площа (м²)"
                        placeholder="0"
                        keyboardType="numeric"
                        value={area}
                        onChangeText={setArea}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Input
                        label="Тариф (₴/м²)"
                        placeholder="0"
                        keyboardType="numeric"
                        value={ratePerSqm}
                        onChangeText={setRatePerSqm}
                      />
                    </View>
                  </View>

                  <Input
                    label="АБО Фіксований внесок (₴/міс)"
                    placeholder="0"
                    keyboardType="numeric"
                    value={fixedFee}
                    onChangeText={setFixedFee}
                  />

                  <Input
                    label="Електронна пошта"
                    placeholder="name@mail.com"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />

                  <Input
                    label="Телефон"
                    placeholder="+380..."
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />

                  <Input
                    label="Початковий баланс (₴)"
                    placeholder="0"
                    keyboardType="numeric"
                    value={balance}
                    onChangeText={setBalance}
                  />

                  <Button
                    title="Зберегти об'єкт"
                    onPress={handleSaveMember}
                    isLoading={saving}
                    style={{ marginTop: 24, marginBottom: 12 }}
                  />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      {/* Charge Dues / Accruals Modal */}
      {chargeModalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={chargeModalVisible}
          onRequestClose={() => setChargeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setChargeModalVisible(false)} />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ width: '100%', justifyContent: 'flex-end' }}
              pointerEvents="box-none"
            >
              <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.cardBorder, maxHeight: modalMaxHeight }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Нарахування внесків</Text>
                  <Pressable onPress={() => setChargeModalVisible(false)} style={styles.closeBtn}>
                    <X size={24} color={colors.text} />
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.modalScroll}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Стаття нарахування *</Text>
                  <View style={styles.propertyTypeRow}>
                    {['regular', 'target', 'charitable', 'waste_removal', 'provider_fee'].map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => {
                          setChargeType(t);
                          if (t === 'target') setChargeDescription('Цільовий внесок');
                          else if (t === 'charitable') setChargeDescription('Благодійний внесок');
                          else if (t === 'waste_removal') setChargeDescription('Вивіз побутових відходів');
                          else if (t === 'provider_fee') setChargeDescription('Оренда провайдерів');
                          else setChargeDescription('Щомісячний внесок за утримання будинку');
                        }}
                        style={[styles.typeSelectBtn, { borderColor: colors.border, paddingHorizontal: 6 }, chargeType === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: chargeType === t ? '#fff' : colors.text }}>
                          {t === 'regular' ? 'Регуляр.' : t === 'target' ? 'Цільов.' : t === 'charitable' ? 'Благодійн.' : t === 'waste_removal' ? 'Відходи' : 'Пров.'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, { color: colors.textMuted, marginTop: 12 }]}>Період *</Text>
                  <View style={styles.propertyTypeRow}>
                    {['monthly', 'quarterly', 'annual'].map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => {
                          setPeriodType(p);
                          setChargeMultiplier(p === 'quarterly' ? '3' : p === 'annual' ? '12' : '1');
                        }}
                        style={[styles.typeSelectBtn, { flex: 1, borderColor: colors.border }, periodType === p && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: periodType === p ? '#fff' : colors.text }}>
                          {p === 'monthly' ? 'Місяць' : p === 'quarterly' ? 'Квартал' : 'Рік'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.formRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Input
                        label="Множник періоду"
                        keyboardType="numeric"
                        value={chargeMultiplier}
                        onChangeText={setChargeMultiplier}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Input
                        label="Фіксована сума (опція)"
                        placeholder="напр. 150"
                        keyboardType="numeric"
                        value={chargeAmountOverride}
                        onChangeText={setChargeAmountOverride}
                      />
                    </View>
                  </View>

                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Особовий рахунок (опція)</Text>
                  <Pressable
                    style={[styles.selectBox, { borderColor: colors.border }]}
                    onPress={() => {
                      setSelectorType('charge_member');
                      setSelectorModalVisible(true);
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 14 }}>
                      {chargeMemberId !== -1 ? (getMemberIdentifier(chargeMemberId) || 'Обрано об\'єкт') : 'Для всіх об\'єктів'}
                    </Text>
                  </Pressable>

                  <Input
                    label="Опис нарахування"
                    value={chargeDescription}
                    onChangeText={setChargeDescription}
                  />

                  <Button
                    title={charging ? "Нараховується..." : "Виконати нарахування"}
                    onPress={handleChargeDues}
                    isLoading={charging}
                    style={{ marginTop: 24, marginBottom: 12 }}
                  />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      {/* Add / Edit Meter Modal */}
      {meterModalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={meterModalVisible}
          onRequestClose={() => setMeterModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setMeterModalVisible(false)} />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ width: '100%', justifyContent: 'flex-end' }}
              pointerEvents="box-none"
            >
              <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.cardBorder, maxHeight: modalMaxHeight }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {editingMeter ? 'Редагувати лічильник' : 'Додати лічильник'}
                  </Text>
                  <Pressable onPress={() => setMeterModalVisible(false)} style={styles.closeBtn}>
                    <X size={24} color={colors.text} />
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.modalScroll}>
                  <Input
                    label="Назва лічильника *"
                    placeholder="напр. Загальний води, Електро дл. 5"
                    value={meterName}
                    onChangeText={setMeterName}
                  />

                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Тип послуги *</Text>
                  <View style={styles.propertyTypeRow}>
                    {['water', 'electricity', 'gas', 'heat'].map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => setMeterType(t)}
                        style={[styles.typeSelectBtn, { flex: 1, borderColor: colors.border }, meterType === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: meterType === t ? '#fff' : colors.text }}>
                          {t === 'water' ? '💧 Вода' : t === 'electricity' ? '⚡ Елек.' : t === 'gas' ? '🔥 Газ' : '🌡️ Тепло'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Input
                    label="Тариф за одиницю (₴) *"
                    keyboardType="numeric"
                    value={meterTariff}
                    onChangeText={setMeterTariff}
                  />

                  <Input
                    label="Початкові показання (м³ або кВт⋅год) *"
                    keyboardType="numeric"
                    value={meterInitialReading}
                    onChangeText={setMeterInitialReading}
                  />

                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Прив'язати до абонента</Text>
                  <Pressable
                    style={[styles.selectBox, { borderColor: colors.border }]}
                    onPress={() => {
                      setSelectorType('meter_member');
                      setSelectorModalVisible(true);
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 14 }}>
                      {meterMemberId !== -1 ? (getMemberIdentifier(meterMemberId) || 'Обрано об\'єкт') : 'Ні (Загальний підприємства)'}
                    </Text>
                  </Pressable>

                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Головний лічильник (ієрархія)</Text>
                  <Pressable
                    style={[styles.selectBox, { borderColor: colors.border }]}
                    onPress={() => {
                      setSelectorType('meter_parent');
                      setSelectorModalVisible(true);
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 14 }}>
                      {meterParentId !== -1 ? (meters.find(m => m.id === meterParentId)?.name || 'Обрано лічильник') : 'Немає (Головний лічильник)'}
                    </Text>
                  </Pressable>

                  <Button
                    title="Зберегти лічильник"
                    onPress={handleSaveMeter}
                    isLoading={savingMeter}
                    style={{ marginTop: 24, marginBottom: 12 }}
                  />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      {/* Enter Meter Reading Modal */}
      {readingModalVisible && selectedMeterForReading && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={readingModalVisible}
          onRequestClose={() => setReadingModalVisible(false)}
        >
          <View style={styles.modalOverlayCenter}>
            <View style={[styles.alertContent, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
              <View style={styles.alertHeader}>
                <Briefcase size={32} color={colors.primary} style={{ marginBottom: 12 }} />
                <Text style={[styles.alertTitle, { color: colors.text }]}>Показники: {selectedMeterForReading.name}</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 16 }}>
                  Попереднє показання: {selectedMeterForReading.last_reading_value || 0} (Тариф: {selectedMeterForReading.tariff} ₴/од.)
                </Text>
              </View>

              <TextInput
                placeholder="Нове значення лічильника..."
                placeholderTextColor={colors.textMuted + '80'}
                keyboardType="numeric"
                value={readingValue}
                onChangeText={setReadingValue}
                style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              />

              <TextInput
                placeholder="Дата зняття показів (РРРР-ММ-ДД)"
                placeholderTextColor={colors.textMuted + '80'}
                value={readingDate}
                onChangeText={setReadingDate}
                style={[styles.modalInput, { color: colors.text, borderColor: colors.border, marginTop: -8 }]}
              />

              <View style={styles.alertActions}>
                <Button
                  title="Скасувати"
                  variant="outline"
                  onPress={() => setReadingModalVisible(false)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Внести"
                  onPress={handleAddReading}
                  isLoading={savingReading}
                  style={{ flex: 1, marginLeft: 8 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Custom Selector Modal (Drop-down substitute) */}
      {selectorModalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={selectorModalVisible}
          onRequestClose={() => setSelectorModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSelectorModalVisible(false)} />
            <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.cardBorder, height: windowHeight * 0.7 }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {selectorType === 'meter_parent' ? 'Оберіть головний лічильник' : 'Оберіть об\'єкт'}
                </Text>
                <Pressable onPress={() => setSelectorModalVisible(false)} style={styles.closeBtn}>
                  <X size={24} color={colors.text} />
                </Pressable>
              </View>

              <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
                <TextInput
                  placeholder="Шукати..."
                  placeholderTextColor={colors.textMuted + '80'}
                  value={selectorSearch}
                  onChangeText={setSelectorSearch}
                  style={[styles.searchInputInline, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              {selectorType === 'meter_parent' ? (
                <FlatList
                  data={[{ id: -1, name: 'Немає (Головний лічильник)' } as any, ...meters.filter(m => m.name.toLowerCase().includes(selectorSearch.toLowerCase()))]}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [styles.selectorItem, { borderBottomColor: colors.cardBorder, backgroundColor: pressed ? colors.border : 'transparent' }]}
                      onPress={() => handleSelectParentMeter(item.id === -1 ? null : item)}
                    >
                      <Text style={{ color: colors.text }}>{item.name}</Text>
                    </Pressable>
                  )}
                />
              ) : (
                <FlatList
                  data={[
                    { id: -1, identifier: 'Не прив\'язувати / скасувати' } as any,
                    ...members.filter(m => 
                      m.identifier.toLowerCase().includes(selectorSearch.toLowerCase()) || 
                      (m.owner_name && m.owner_name.toLowerCase().includes(selectorSearch.toLowerCase()))
                    )
                  ]}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [styles.selectorItem, { borderBottomColor: colors.cardBorder, backgroundColor: pressed ? colors.border : 'transparent' }]}
                      onPress={() => handleSelectMember(item.id === -1 ? null : item)}
                    >
                      <Text style={{ color: colors.text, fontWeight: item.id === -1 ? '400' : '700' }}>
                        {item.id === -1 ? item.identifier : `${item.property_type || 'кв.'} ${item.identifier} (${item.owner_name || 'Немає імені'})`}
                      </Text>
                    </Pressable>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Member Details Modal (Subscriber Card) */}
      {memberDetailsModalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={memberDetailsModalVisible}
          onRequestClose={() => setMemberDetailsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setMemberDetailsModalVisible(false)} />
            <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.cardBorder, height: windowHeight * 0.8 }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Картка абонента</Text>
                <Pressable onPress={() => setMemberDetailsModalVisible(false)} style={styles.closeBtn}>
                  <X size={24} color={colors.text} />
                </Pressable>
              </View>

              {loadingDetails ? (
                <View style={[styles.center, { flex: 1 }]}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : selectedMemberDetails ? (
                <View style={{ flex: 1 }}>
                  {/* Subscriber summary card */}
                  <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
                    <Card style={{ padding: 12, marginBottom: 8, backgroundColor: colors.inputBg }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 }}>
                        {selectedMemberDetails.member.property_type || 'кв.'} {selectedMemberDetails.member.identifier}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.text, marginBottom: 6 }}>
                        👤 {selectedMemberDetails.member.owner_name || 'Власник не вказаний'}
                      </Text>
                      {selectedMemberDetails.member.phone && (
                        <Pressable onPress={() => handleContactPress(selectedMemberDetails.member.phone!)}>
                          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700', marginBottom: 6 }}>
                            📞 {selectedMemberDetails.member.phone} (подзвонити / SMS)
                          </Text>
                        </Pressable>
                      )}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                          Площа: {selectedMemberDetails.member.area || 0} м²
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                          Тариф: {selectedMemberDetails.member.rate_per_sqm || 0} ₴/м²
                        </Text>
                      </View>
                      {selectedMemberDetails.member.fixed_monthly_fee ? (
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                          Фікс. внесок: {selectedMemberDetails.member.fixed_monthly_fee} ₴/міс
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>Баланс:</Text>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: selectedMemberDetails.member.balance < 0 ? colors.error : colors.success }}>
                          {selectedMemberDetails.member.balance.toLocaleString('uk-UA')} ₴
                        </Text>
                      </View>
                      {selectedMemberDetails.member.balance < 0 && Platform.OS !== 'ios' ? (
                        <Button
                          title={payingMono ? "Створення рахунку..." : "Оплатити через Mono Pay"}
                          onPress={() => handlePayMonoInvoice(selectedMemberDetails.member)}
                          isLoading={payingMono}
                          variant="primary"
                          style={{ marginTop: 12, minHeight: 38 }}
                        />
                      ) : null}
                    </Card>
                  </View>

                  {/* Tab switches */}
                  <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.cardBorder, marginHorizontal: 20 }}>
                    {['readings', 'charges', 'payments'].map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => setDetailsActiveTab(t as any)}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          alignItems: 'center',
                          borderBottomWidth: detailsActiveTab === t ? 2 : 0,
                          borderColor: colors.primary,
                        }}
                      >
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color: detailsActiveTab === t ? colors.primary : colors.textMuted
                        }}>
                          {t === 'readings' ? 'Показники' : t === 'charges' ? 'Нарахування' : 'Оплати'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <ScrollView style={{ flex: 1, padding: 20 }}>
                    {detailsActiveTab === 'readings' && (
                      <View style={{ paddingBottom: 20 }}>
                        {selectedMemberDetails.meters.length === 0 ? (
                          <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
                            Лічильники відсутні
                          </Text>
                        ) : (
                          selectedMemberDetails.meters.map((meter: any) => (
                            <View key={meter.id} style={{ marginBottom: 16 }}>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
                                {meter.name} ({meter.type === 'electricity' ? '⚡ Електро' : meter.type === 'water' ? '💧 Вода' : meter.type === 'gas' ? '🔥 Gas' : '🌡️ Тепло'})
                              </Text>
                              {meter.readings.length === 0 ? (
                                <Text style={{ color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginLeft: 8 }}>
                                  Немає записаних показників
                                </Text>
                              ) : (
                                meter.readings.map((r: any) => (
                                  <View key={r.id} style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    paddingVertical: 8,
                                    borderBottomWidth: 1,
                                    borderColor: colors.cardBorder,
                                    marginLeft: 8
                                  }}>
                                    <View>
                                      <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>
                                        {r.reading_value}
                                      </Text>
                                      <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                        {r.reading_date}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                      {r.charge_amount !== null && r.charge_amount !== undefined && (
                                        <Text style={{ fontSize: 12, color: colors.error, fontWeight: '600' }}>
                                          -{r.charge_amount} ₴
                                        </Text>
                                      )}
                                      {r.is_locked ? (
                                        <Text style={{ fontSize: 14 }}>🔒</Text>
                                      ) : (
                                        <Pressable onPress={() => handleDeleteMeterReading(meter.id, r.id)} style={{ padding: 4 }}>
                                          <Trash2 size={16} color={colors.error} />
                                        </Pressable>
                                      )}
                                    </View>
                                  </View>
                                ))
                              )}
                            </View>
                          ))
                        )}
                      </View>
                    )}

                    {detailsActiveTab === 'charges' && (
                      <View style={{ paddingBottom: 20 }}>
                        {selectedMemberDetails.charges.length === 0 ? (
                          <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
                            Нарахування відсутні
                          </Text>
                        ) : (
                          selectedMemberDetails.charges.map((c: any) => (
                            <View key={c.id} style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingVertical: 10,
                              borderBottomWidth: 1,
                              borderColor: colors.cardBorder
                            }}>
                              <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>
                                  {c.description || 'Нарахування внесків'}
                                </Text>
                                <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                  {c.date} ({c.charge_type === 'utility' ? 'комунальні' : 'внески'})
                                </Text>
                              </View>
                              <Text style={{ fontSize: 13, color: colors.error, fontWeight: '700' }}>
                                -{c.amount.toLocaleString('uk-UA')} ₴
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    )}

                    {detailsActiveTab === 'payments' && (
                      <View style={{ paddingBottom: 20 }}>
                        {selectedMemberDetails.payments.length === 0 ? (
                          <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
                            Оплати відсутні
                          </Text>
                        ) : (
                          selectedMemberDetails.payments.map((p: any) => (
                            <View key={p.id} style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingVertical: 10,
                              borderBottomWidth: 1,
                              borderColor: colors.cardBorder
                            }}>
                              <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>
                                  {p.contragent || 'Платіж'}
                                </Text>
                                <Text style={{ fontSize: 10, color: colors.textMuted }} numberOfLines={1}>
                                  {p.date} • {p.purpose}
                                </Text>
                              </View>
                              <Text style={{ fontSize: 13, color: colors.success, fontWeight: '700' }}>
                                +{p.amount.toLocaleString('uk-UA')} ₴
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </ScrollView>
                </View>
              ) : (
                <View style={[styles.center, { flex: 1 }]}>
                  <Text style={{ color: colors.textMuted }}>Не вдалося завантажити картку абонента</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
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
  nonProfitTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  nonProfitDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  tabSegment: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    height: 48,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentBtnActive: {
    borderBottomWidth: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionBar: {
    padding: 16,
    borderBottomWidth: 1,
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  statsScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  statVal: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  memberCard: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  memberTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '900',
  },
  memberIdentifier: {
    fontSize: 15,
    fontWeight: '800',
  },
  memberName: {
    fontSize: 12,
    marginTop: 2,
  },
  balanceBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  balanceText: {
    fontSize: 13,
    fontWeight: '800',
  },
  detailsRow: {
    marginVertical: 4,
  },
  detailText: {
    fontSize: 12,
  },
  contactText: {
    fontSize: 12,
    marginTop: 4,
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  formRow: {
    flexDirection: 'row',
  },
  alertContent: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  alertHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalInput: {
    width: '105%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginBottom: 20,
  },
  alertActions: {
    flexDirection: 'row',
    width: '100%',
  },
  propertyTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 8,
  },
  typeSelectBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  parentLinkText: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    marginTop: 2,
  },
  purposeText: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  reconcileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unmatchedRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  selectMemberBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  selectorItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  searchInputInline: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    fontSize: 14,
  },
  actionBtnInline: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  iconActionSmall: {
    padding: 6,
  },
});
