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
  Switch,
  RefreshControl,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { api, ProfileData } from '../../services/api';
import { haptics } from '../../services/haptics';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  UploadCloud,
  CheckCircle2,
  XCircle,
  X,
  Edit3,
  Percent,
  Plus,
  Calendar as CalendarIcon,
  Trash2,
} from 'lucide-react-native';
const { ArrowLeft, ArrowRight } = require('lucide-react-native');
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const { telegramId } = useAuth();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  const modalMaxHeight = Math.min(windowHeight * 0.8, windowHeight - keyboardHeight - 100);

  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTaxable, setFilterTaxable] = useState<'all' | 'taxable' | 'non_taxable'>('all');

  // Advanced Filtering State
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'month' | 'quarter' | 'year'>('all');
  const [filterType, setFilterType] = useState<'all' | 'tax_payment' | 'salary_payment' | 'income' | 'expense'>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [txTaxable, setTxTaxable] = useState(true);
  const [txType, setTxType] = useState<'income' | 'expense' | 'own_funds' | 'refund' | 'loan'>('income');
  const [txContragent, setTxContragent] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [updating, setUpdating] = useState(false);

  // Load profile and transactions on focus
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
        await fetchTransactions(activeProfile.id);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити транзакції');
      setLoading(false);
    }
  };

  const fetchTransactions = async (profileId: number) => {
    try {
      const data = await api.getTransactions(profileId);
      setTransactions(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося отримати транзакції з сервера');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedProfile) {
      await fetchTransactions(selectedProfile.id);
    } else {
      await loadData();
    }
  };

  const handleOpenEdit = (tx: any) => {
    setSelectedTx(tx);
    setTxTaxable(tx.taxable);
    setTxType(tx.transaction_type || 'income');
    setTxContragent(tx.contragent || '');
    setTxAmount(String(tx.amount || ''));
    setEditModalVisible(true);
  };

  const handleSaveTx = async () => {
    if (!selectedTx) return;
    setUpdating(true);
    try {
      await api.updateTransaction(selectedTx.id, {
        taxable: txTaxable,
        transaction_type: txType,
        contragent: txContragent,
        amount: txAmount ? parseFloat(txAmount) : undefined,
      });
      haptics.success();
      setEditModalVisible(false);
      if (selectedProfile) {
        fetchTransactions(selectedProfile.id);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося оновити транзакцію');
    } finally {
      setUpdating(false);
    }
  };

  const handleClearStatements = async () => {
    if (!selectedProfile) return;
    Alert.alert(
      'Видалення виписок',
      'Ви впевнені, що хочете видалити всі завантажені виписки та транзакції для цього профілю? Цю дію неможливо скасувати.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити все',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await api.clearStatements(selectedProfile.id);
              haptics.success();
              Alert.alert('Успіх', 'Усі виписки та транзакції успішно видалено!');
              setTransactions([]);
            } catch (e: any) {
              console.error(e);
              Alert.alert('Помилка', 'Не вдалося видалити виписки');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getActivePeriodText = () => {
    const year = selectedDate.getFullYear();
    if (filterPeriod === 'month') {
      const monthNames = [
        'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
        'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
      ];
      return `${monthNames[selectedDate.getMonth()]} ${year}`;
    }
    if (filterPeriod === 'quarter') {
      const quarters = ['I кв.', 'II кв.', 'III кв.', 'IV кв.'];
      const qIndex = Math.floor(selectedDate.getMonth() / 3);
      return `${quarters[qIndex]} ${year}`;
    }
    if (filterPeriod === 'year') {
      return `${year} рік`;
    }
    return '';
  };

  const handlePrevPeriod = () => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      if (filterPeriod === 'month') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else if (filterPeriod === 'quarter') {
        newDate.setMonth(newDate.getMonth() - 3);
      } else if (filterPeriod === 'year') {
        newDate.setFullYear(newDate.getFullYear() - 1);
      }
      return newDate;
    });
  };

  const handleNextPeriod = () => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      if (filterPeriod === 'month') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else if (filterPeriod === 'quarter') {
        newDate.setMonth(newDate.getMonth() + 3);
      } else if (filterPeriod === 'year') {
        newDate.setFullYear(newDate.getFullYear() + 1);
      }
      return newDate;
    });
  };

  // Simulated statement import for demo purposes
  const handleSimulatedUpload = async () => {
    if (!selectedProfile) return;
    
    Alert.alert(
      'Імпорт виписки',
      'Оберіть спосіб завантаження банківської виписки:',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Завантажити файл виписки',
          onPress: async () => {
            try {
              const res = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
              });

              if (res.canceled || !res.assets || res.assets.length === 0) {
                return;
              }

              const asset = res.assets[0];
              setLoading(true);

              await api.uploadStatement(
                selectedProfile.id,
                asset.uri,
                asset.name || 'statement.csv',
                asset.mimeType || 'text/csv'
              );

              haptics.success();
              Alert.alert('Успіх', 'Виписку успішно завантажено та розпізнано бекендом!');
              fetchTransactions(selectedProfile.id);
            } catch (e: any) {
              console.error(e);
              const errMsg = e.response?.data?.detail || e.message || 'Не вдалося завантажити виписку';
              Alert.alert('Помилка імпорту', errMsg);
            } finally {
              setLoading(false);
            }
          }
        },
        {
          text: 'Симуляція Monobank',
          onPress: async () => {
            setLoading(true);
            try {
              const csvContent = 
                "Date and time,Description,MCC,Card currency amount,Operation amount\n" +
                "25.03.2025 14:32:10,Зарахування ФОП Петренко Іван,4814,24500.00,24500.00\n" +
                "27.03.2025 10:15:22,Сплата єдиного податку ФОП,9311,-1225.00,-1225.00\n" +
                "28.03.2025 18:40:00,Сплата ЄСВ ФОП,9311,-1562.00,-1562.00\n" +
                "29.03.2025 11:05:00,Поповнення власними коштами,4814,5000.00,5000.00";
              
              const base64Csv = 'data:text/csv;base64,' + btoa(unescape(encodeURIComponent(csvContent)));
              
              await api.uploadStatement(selectedProfile.id, base64Csv, 'monobank_simulated.csv', 'text/csv');
              haptics.success();
              Alert.alert('Успіх', 'Симульовану виписку успішно завантажено та розпізнано!');
              fetchTransactions(selectedProfile.id);
            } catch (e) {
              console.error(e);
              Alert.alert('Помилка', 'Не вдалося симулювати завантаження виписки');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Helper to convert base64 (since btoa is not built-in on ancient environments, we do inline base64 helper or simple btoa check)
  const btoa = (input: string) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = input;
    let output = '';
    for (let block = 0, charCode, i = 0, map = chars;
         str.charAt(i | 0) || (map = '=', i % 1);
         output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
      charCode = str.charCodeAt(i += 3/4);
      if (charCode > 0xFF) {
        throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
      }
      block = block << 8 | charCode;
    }
    return output;
  };

  const getCategoryLabel = (type: string) => {
    switch (type) {
      case 'income':
        return 'Дохід';
      case 'expense':
        return 'Витрати';
      case 'own_funds':
        return 'Власні кошти';
      case 'refund':
        return 'Повернення';
      case 'loan':
        return 'Кредит / Позика';
      case 'tax_payment':
        return 'Сплата податків';
      case 'salary_payment':
        return 'Виплата зарплати';
      default:
        return 'Не визначено';
    }
  };

  // Filtered transactions
  const filteredTxs = transactions.filter((tx) => {
    // 1. Taxable Filter
    if (filterTaxable === 'taxable' && !tx.taxable) return false;
    if (filterTaxable === 'non_taxable' && tx.taxable) return false;

    // 2. Type Filter
    if (filterType !== 'all') {
      if (filterType === 'tax_payment') {
        if (tx.type !== 'tax_payment' && tx.transaction_type !== 'tax_payment') return false;
      } else if (filterType === 'salary_payment') {
        if (tx.type !== 'salary_payment' && tx.transaction_type !== 'salary_payment') return false;
      } else if (filterType === 'income') {
        if (tx.transaction_type !== 'income' && tx.type !== 'income') return false;
      } else if (filterType === 'expense') {
        if (tx.transaction_type !== 'expense' && tx.type !== 'expense') return false;
      }
    }

    // 3. Period Filter
    if (filterPeriod !== 'all') {
      if (!tx.date) return false;
      const txDate = new Date(tx.date);
      if (isNaN(txDate.getTime())) return false;

      const selYear = selectedDate.getFullYear();
      const selMonth = selectedDate.getMonth();

      if (filterPeriod === 'month') {
        return txDate.getFullYear() === selYear && txDate.getMonth() === selMonth;
      } else if (filterPeriod === 'quarter') {
        const selQuarter = Math.floor(selMonth / 3);
        const txQuarter = Math.floor(txDate.getMonth() / 3);
        return txDate.getFullYear() === selYear && txQuarter === selQuarter;
      } else if (filterPeriod === 'year') {
        return txDate.getFullYear() === selYear;
      }
    }

    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Expanded Premium Filters Section */}
      <View style={[styles.filterBarContainer, { borderBottomColor: colors.cardBorder, backgroundColor: colors.card }]}>
        
        {/* Row 1: Taxable & Action Buttons */}
        <View style={styles.topFilterRow}>
          <View style={styles.segmentedFilter}>
            <Pressable
              style={[styles.filterSegment, filterTaxable === 'all' && { backgroundColor: colors.primary }]}
              onPress={() => setFilterTaxable('all')}
            >
              <Text style={[styles.filterSegmentText, filterTaxable === 'all' ? { color: '#ffffff' } : { color: colors.text }]}>
                Всі
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterSegment, filterTaxable === 'taxable' && { backgroundColor: colors.primary }]}
              onPress={() => setFilterTaxable('taxable')}
            >
              <Text style={[styles.filterSegmentText, filterTaxable === 'taxable' ? { color: '#ffffff' } : { color: colors.text }]}>
                Оподатк.
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterSegment, filterTaxable === 'non_taxable' && { backgroundColor: colors.primary }]}
              onPress={() => setFilterTaxable('non_taxable')}
            >
              <Text style={[styles.filterSegmentText, filterTaxable === 'non_taxable' ? { color: '#ffffff' } : { color: colors.text }]}>
                Неопод.
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable style={[styles.uploadBtn, { backgroundColor: colors.primaryMuted }]} onPress={handleSimulatedUpload}>
              <UploadCloud size={16} color={colors.primary} />
              <Text style={[styles.uploadBtnText, { color: colors.primary }]}>Імпорт</Text>
            </Pressable>
            <Pressable style={[styles.clearBtn, { backgroundColor: colors.errorMuted, marginLeft: 8 }]} onPress={handleClearStatements}>
              <Trash2 size={16} color={colors.error} />
            </Pressable>
          </View>
        </View>

        {/* Row 2: Period Selection */}
        <View style={styles.periodFilterRow}>
          <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Період:</Text>
          <View style={styles.periodSegments}>
            {(['all', 'month', 'quarter', 'year'] as const).map((p) => {
              const label = p === 'all' ? 'Всі' : p === 'month' ? 'Місяць' : p === 'quarter' ? 'Квартал' : 'Рік';
              return (
                <Pressable
                  key={p}
                  style={[
                    styles.periodSegment,
                    filterPeriod === p && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
                  ]}
                  onPress={() => setFilterPeriod(p)}
                >
                  <Text style={[styles.periodSegmentText, filterPeriod === p ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Row 3: Period Navigation Controls */}
        {filterPeriod !== 'all' && (
          <View style={[styles.navigatorRow, { borderColor: colors.border }]}>
            <Pressable onPress={handlePrevPeriod} style={styles.navBtn}>
              <ArrowLeft size={18} color={colors.primary} />
            </Pressable>
            <Text style={[styles.navText, { color: colors.text }]}>{getActivePeriodText()}</Text>
            <Pressable onPress={handleNextPeriod} style={styles.navBtn}>
              <ArrowRight size={18} color={colors.primary} />
            </Pressable>
          </View>
        )}

        {/* Row 4: Transaction Types Horizontal Scroll */}
        <View style={styles.typeFilterRow}>
          <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Тип:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScroll}>
            {[
              { type: 'all', label: 'Всі' },
              { type: 'tax_payment', label: 'Податки 🧾' },
              { type: 'salary_payment', label: 'Зарплати 👥' },
              { type: 'income', label: 'Дохід 📈' },
              { type: 'expense', label: 'Витрати 📉' },
            ].map((t) => (
              <Pressable
                key={t.type}
                style={[
                  styles.typeBtn,
                  filterType === t.type && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setFilterType(t.type as any)}
              >
                <Text style={[styles.typeBtnText, filterType === t.type ? { color: '#ffffff' } : { color: colors.text }]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredTxs.length === 0 ? (
        <View style={styles.center}>
          <Percent size={48} color={colors.textMuted} style={styles.emptyIcon} />
          <Text style={[styles.emptyText, { color: colors.text }]}>Немає операцій</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Завантажте банківську виписку, щоб побачити транзакції та почати розрахунок податків.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTxs}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            const isIncome = item.direction === 'in';
            return (
              <Pressable onPress={() => handleOpenEdit(item)}>
                <Card style={styles.txCard}>
                  <View style={styles.txRow}>
                    <View style={[styles.directionIcon, { backgroundColor: isIncome ? colors.successMuted : colors.errorMuted }]}>
                      {isIncome ? (
                        <ArrowUpRight size={18} color={colors.success} />
                      ) : (
                        <ArrowDownLeft size={18} color={colors.error} />
                      )}
                    </View>

                    <View style={styles.txInfo}>
                      <Text style={[styles.contragent, { color: colors.text }]} numberOfLines={1}>
                        {item.contragent || 'Невідомий контрагент'}
                      </Text>
                      <Text style={[styles.purpose, { color: colors.textMuted }]} numberOfLines={2}>
                        {item.purpose}
                      </Text>
                      <View style={styles.tagsRow}>
                        <Text style={[styles.categoryTag, { color: colors.primary, backgroundColor: colors.primaryMuted }]}>
                          {getCategoryLabel(item.transaction_type)}
                        </Text>
                        {item.taxable ? (
                          <View style={[styles.badge, { backgroundColor: colors.successMuted }]}>
                            <CheckCircle2 size={12} color={colors.success} style={styles.badgeIcon} />
                            <Text style={[styles.badgeText, { color: colors.success }]}>Оподатковуване</Text>
                          </View>
                        ) : (
                          <View style={[styles.badge, { backgroundColor: colors.border }]}>
                            <XCircle size={12} color={colors.textMuted} style={styles.badgeIcon} />
                            <Text style={[styles.badgeText, { color: colors.textMuted }]}>Неоподатк.</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.txAmountContainer}>
                      <Text style={[styles.amount, { color: isIncome ? colors.success : colors.text }]}>
                        {isIncome ? '+' : '-'}
                        {item.amount?.toLocaleString('uk-UA')} ₴
                      </Text>
                      <Text style={[styles.date, { color: colors.textMuted }]}>
                        {item.date?.split('T')[0]}
                      </Text>
                      <View style={styles.editIndicator}>
                        <Edit3 size={12} color={colors.textMuted} />
                      </View>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}

      {/* Edit Transaction Modal */}
      {editModalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={editModalVisible}
          onRequestClose={() => setEditModalVisible(false)}
        >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setEditModalVisible(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', justifyContent: 'flex-end' }}
            pointerEvents="box-none"
          >
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.cardBorder,
                  maxHeight: modalMaxHeight,
                  overflow: 'hidden',
                  width: '100%',
                  flexGrow: 0,
                  flexShrink: 1,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Редагувати операцію</Text>
                <Pressable onPress={() => setEditModalVisible(false)} style={styles.closeBtn}>
                  <X size={24} color={colors.text} />
                </Pressable>
              </View>

                  <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                    <View style={styles.txDetailBox}>
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Контрагент (можна редагувати)</Text>
                      <TextInput
                        style={[
                          styles.modalInput,
                          {
                            color: colors.text,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                          }
                        ]}
                        value={txContragent}
                        onChangeText={setTxContragent}
                        placeholder="Невідомий контрагент"
                        placeholderTextColor={colors.textMuted + '80'}
                      />

                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Призначення платежу</Text>
                      <Text style={[styles.detailVal, { color: colors.text, fontSize: 13 }]}>
                        {selectedTx?.purpose}
                      </Text>

                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Сума операції (можна редагувати)</Text>
                      <TextInput
                        style={[
                          styles.modalInput,
                          {
                            color: colors.text,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                          }
                        ]}
                        keyboardType="numeric"
                        value={txAmount}
                        onChangeText={setTxAmount}
                        placeholder="Сума в ₴"
                        placeholderTextColor={colors.textMuted + '80'}
                      />
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    {/* Taxable Toggle */}
                    <View style={styles.switchRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.switchTitle, { color: colors.text }]}>Враховувати в податках</Text>
                        <Text style={[styles.switchDesc, { color: colors.textMuted }]} numberOfLines={2}>
                          Чи є ця операція об'єктом оподаткування?
                        </Text>
                      </View>
                      <Switch
                        value={txTaxable}
                        onValueChange={setTxTaxable}
                        trackColor={{ false: '#767577', true: colors.primary }}
                        thumbColor={txTaxable ? '#ffffff' : '#f4f3f4'}
                      />
                    </View>

                    {/* Category selection */}
                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Категорія операції</Text>
                    <View style={styles.categoryGrid}>
                      {[
                        { type: 'income', label: 'Дохід' },
                        { type: 'expense', label: 'Витрати' },
                        { type: 'own_funds', label: 'Власні' },
                        { type: 'refund', label: 'Поверн.' },
                        { type: 'loan', label: 'Позика' },
                      ].map((c) => (
                        <Pressable
                          key={c.type}
                          style={[
                            styles.categoryBtn,
                            txType === c.type && { backgroundColor: colors.primary },
                            { borderColor: colors.cardBorder },
                          ]}
                          onPress={() => setTxType(c.type as any)}
                        >
                          <Text style={[styles.categoryBtnText, txType === c.type && { color: '#ffffff' }, { color: colors.text }]}>
                            {c.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Button
                      title="Зберегти зміни"
                      onPress={handleSaveTx}
                      isLoading={updating}
                      style={styles.saveBtn}
                    />
                  </ScrollView>
            </View>
          </KeyboardAvoidingView>
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
  },
  segmentedFilter: {
    flexDirection: 'row',
    backgroundColor: 'rgba(120, 120, 128, 0.1)',
    borderRadius: 8,
    padding: 2,
    flex: 1,
    marginRight: 12,
  },
  filterSegment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterSegmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  txCard: {
    padding: 12,
    marginBottom: 8,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  directionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
    marginRight: 8,
  },
  contragent: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  purpose: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTag: {
    fontSize: 10,
    fontWeight: '600',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginRight: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  txAmountContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  date: {
    fontSize: 11,
    marginBottom: 4,
  },
  editIndicator: {
    padding: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: Dimensions.get('window').height * 0.80,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    flexGrow: 0,
    flexShrink: 1,
    overflow: 'hidden',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  txDetailBox: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(120, 120, 128, 0.05)',
  },
  detailLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailVal: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  switchDesc: {
    fontSize: 12,
    marginTop: 2,
    maxWidth: '80%',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  categoryBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  categoryBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  saveBtn: {
    marginTop: 8,
  },
  filterBarContainer: {
    padding: 12,
    borderBottomWidth: 1,
  },
  topFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 50,
  },
  periodSegments: {
    flexDirection: 'row',
    flex: 1,
  },
  periodSegment: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 4,
  },
  periodSegmentText: {
    fontSize: 11,
    fontWeight: '600',
  },
  navigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  navBtn: {
    padding: 6,
  },
  navText: {
    fontSize: 13,
    fontWeight: '700',
  },
  typeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeScroll: {
    alignItems: 'center',
  },
  typeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(120, 120, 128, 0.2)',
    marginRight: 6,
  },
  typeBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 12,
  },
});
