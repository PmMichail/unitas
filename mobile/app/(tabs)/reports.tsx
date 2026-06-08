import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { api, ProfileData } from '../../services/api';
import { haptics } from '../../services/haptics';
import { useFocusEffect } from 'expo-router';
import { FileText, Calendar, PlusCircle, Share2, Clipboard, ShieldCheck, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ReportsScreen() {
  const { colors } = useTheme();
  const { telegramId } = useAuth();

  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form State
  const [period, setPeriod] = useState('1 Квартал');
  const [formCode, setFormCode] = useState('F0103306');

  // Sync default form on profile change
  React.useEffect(() => {
    if (selectedProfile) {
      if (selectedProfile.type === 'company') {
        setFormCode('J0500109');
      } else {
        setFormCode('F0103306');
      }
    }
  }, [selectedProfile]);

  const getPeriodsForForm = () => {
    return [
      { key: '1 Квартал', label: 'Q1' },
      { key: 'Півріччя', label: 'Q2' },
      { key: 'Три Квартали', label: 'Q3' },
      { key: 'Рік', label: 'Рік' },
      { key: 'Січень', label: 'Січ' },
      { key: 'Лютий', label: 'Лют' },
      { key: 'Березень', label: 'Бер' },
      { key: 'Квітень', label: 'Кві' },
      { key: 'Травень', label: 'Тра' },
      { key: 'Червень', label: 'Чер' },
      { key: 'Липень', label: 'Лип' },
      { key: 'Серпень', label: 'Сер' },
      { key: 'Вересень', label: 'Вер' },
      { key: 'Жовтень', label: 'Жов' },
      { key: 'Листопад', label: 'Лис' },
      { key: 'Грудень', label: 'Гру' },
    ];
  };

  const getFormsForProfile = () => {
    if (selectedProfile?.type === 'company') {
      return [
        { key: 'J0500109', label: "J0500109 (Об'єднаний ТОВ)" },
        { key: 'F0110210', label: 'F0110210 (ПДВ ТОВ)' },
      ];
    } else {
      return [
        { key: 'F0103306', label: 'F0103306 (Єдинник)' },
        { key: 'F0510101', label: "F0510101 (Об'єднаний ФОП)" },
        { key: 'F3007012', label: 'F3007012 (ЄСВ)' },
        { key: 'F0120109', label: 'F0120109 (Військовий)' },
        { key: 'F0600101', label: 'F0600101 (ПДФО)' },
      ];
    }
  };

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
        await fetchReports(activeProfile.id);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити дані звітів');
      setLoading(false);
    }
  };

  const fetchReports = async (profileId: number) => {
    try {
      const data = await api.getReportsList(profileId);
      setReports(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося отримати архів звітів');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedProfile) {
      await fetchReports(selectedProfile.id);
    } else {
      await loadData();
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedProfile) return;
    
    setGenerating(true);
    try {
      await api.generateReport(selectedProfile.id, period, formCode);
      haptics.success();
      Alert.alert(
        'Звіт згенеровано',
        `Податкову декларацію за період ${period} успішно згенеровано у форматі XML (F0103306), готову до подання.`
      );
      fetchReports(selectedProfile.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося згенерувати декларацію. Перевірте наявність транзакцій за цей період.');
    } finally {
      setGenerating(false);
    }
  };

  const handleShareReport = async (reportId: number, reportTitle: string, format: 'xml' | 'pdf' = 'xml') => {
    const downloadUrl = api.getReportDownloadUrl(reportId, format);
    try {
      await Share.share({
        message: `Декларація UniTax ${format.toUpperCase()} (${reportTitle}): ${downloadUrl}`,
        url: downloadUrl,
        title: `Завантажити ${format.toUpperCase()} звіт UniTax`,
      });
      haptics.light();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteReport = async (reportId: number) => {
    Alert.alert(
      'Видалити звіт',
      'Ви впевнені, що хочете видалити цей звіт?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteReport(reportId);
              haptics.success();
              Alert.alert('Успіх', 'Звіт успішно видалено');
              if (selectedProfile) {
                fetchReports(selectedProfile.id);
              }
            } catch (e) {
              console.error(e);
              Alert.alert('Помилка', 'Не вдалося видалити звіт');
            }
          },
        },
      ]
    );
  };

  const getPeriodLabel = (p: string) => {
    if (!p) return '';
    const parts = p.split('-');
    const year = parts[0];
    const term = parts[1];
    
    if (!term) {
      const pLower = p.toLowerCase();
      if (pLower === 'year' || pLower === 'рік') return 'Рік';
      if (pLower === 'q1' || pLower === '1 квартал') return '1-й квартал';
      if (pLower === 'q2' || pLower === 'півріччя') return 'Півріччя (2-й квартал)';
      if (pLower === 'q3' || pLower === 'три квартали') return '3-й квартал';
      if (pLower === 'q4') return '4-й квартал';
      return p;
    }
    
    if (term === 'year') return `Рік ${year}`;
    if (term.startsWith('Q')) {
      const qNum = term.replace('Q', '');
      return `${qNum}-й квартал ${year}`;
    }
    return p;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : profiles.length === 0 ? (
        <View style={styles.center}>
          <FileText size={64} color={colors.textMuted} style={styles.emptyIcon} />
          <Text style={[styles.emptyText, { color: colors.text }]}>Немає активних профілів</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Створіть податковий профіль ФОП або юридичної особи для генерації декларацій.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Generation Config Card */}
          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Нова декларація</Text>
            <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
              Автоматично розрахувати доходи на основі завантажених виписок та сформувати XML-файл для податкової.
            </Text>

            {/* Period Selector */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Звітний період</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            >
              {getPeriodsForForm().map((item) => (
                <Pressable
                  key={item.key}
                  style={[
                    styles.segmentButton,
                    period === item.key ? { backgroundColor: colors.primary } : { backgroundColor: colors.border + '30' },
                  ]}
                  onPress={() => {
                    setPeriod(item.key);
                    haptics.light();
                  }}
                >
                  <Text style={[
                    styles.segmentButtonText, 
                    period === item.key ? { color: '#ffffff', fontWeight: 'bold' } : { color: colors.text }
                  ]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Template Selector */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Форма звіту</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={{ gap: 8, paddingBottom: 8, marginTop: 4 }}
            >
              {getFormsForProfile().map((item) => (
                <Pressable
                  key={item.key}
                  style={[
                    styles.segmentButton,
                    formCode === item.key ? { backgroundColor: colors.primary } : { backgroundColor: colors.border + '30' },
                  ]}
                  onPress={() => {
                    setFormCode(item.key);
                    haptics.light();
                  }}
                >
                  <Text style={[
                    styles.segmentButtonText, 
                    formCode === item.key ? { color: '#ffffff', fontWeight: 'bold' } : { color: colors.text }
                  ]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Button
              title="Згенерувати XML звіт"
              onPress={handleGenerateReport}
              isLoading={generating}
              style={styles.generateBtn}
            />
          </Card>

          {/* Generated History */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Архів згенерованих звітів</Text>
          {reports.length === 0 ? (
            <Card style={styles.emptyHistory}>
              <FileText size={24} color={colors.textMuted} style={styles.emptyHistoryIcon} />
              <Text style={[styles.emptyHistoryText, { color: colors.textMuted }]}>
                У вас ще немає згенерованих звітів
              </Text>
            </Card>
          ) : (
            reports.map((report) => (
              <Card key={report.id} style={styles.reportItemCard}>
                <View style={styles.reportRow}>
                  <View style={[styles.reportIconBg, { backgroundColor: colors.successMuted }]}>
                    <ShieldCheck size={20} color={colors.success} />
                  </View>

                  <View style={styles.reportDetails}>
                    <Text style={[styles.reportTitleText, { color: colors.text }]}>
                      Декларація {report.form_code}
                    </Text>
                    <Text style={[styles.reportMeta, { color: colors.textMuted }]}>
                      Період: {getPeriodLabel(report.period)} • {report.year}
                    </Text>
                    <Text style={[styles.reportDate, { color: colors.textMuted }]}>
                      Створено: {report.created_at}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable
                      style={[styles.shareActionBtn, { backgroundColor: colors.primaryMuted }]}
                      onPress={() =>
                        handleShareReport(report.id, `${report.form_code} - ${report.period}`, 'xml')
                      }
                    >
                      <Share2 size={16} color={colors.primary} />
                      <Text style={[styles.shareActionText, { color: colors.primary }]}>XML</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.shareActionBtn, { backgroundColor: colors.primaryMuted, marginLeft: 8 }]}
                      onPress={() =>
                        handleShareReport(report.id, `${report.form_code} - ${report.period}`, 'pdf')
                      }
                    >
                      <FileText size={16} color={colors.primary} />
                      <Text style={[styles.shareActionText, { color: colors.primary }]}>PDF</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.deleteActionBtn, { backgroundColor: colors.errorMuted, marginLeft: 8 }]}
                      onPress={() => handleDeleteReport(report.id)}
                    >
                      <Trash2 size={16} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: 'rgba(120, 120, 128, 0.1)',
    padding: 2,
    marginBottom: 12,
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
  generateBtn: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    paddingLeft: 4,
  },
  emptyHistory: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryIcon: {
    marginBottom: 8,
  },
  emptyHistoryText: {
    fontSize: 13,
  },
  reportItemCard: {
    padding: 14,
    marginBottom: 8,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reportDetails: {
    flex: 1,
    marginRight: 8,
  },
  reportTitleText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  reportMeta: {
    fontSize: 12,
    marginBottom: 2,
  },
  reportDate: {
    fontSize: 11,
  },
  shareActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  shareActionText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  deleteActionBtn: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  segmentButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(120, 120, 128, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  segmentButtonText: {
    fontSize: 13,
  },
});
