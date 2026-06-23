import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../ui/Card';
import { api } from '../../services/api';
import { ShieldAlert, Users, Award, Flame } from 'lucide-react-native';

export default function ResidentTransparency() {
  const { colors, isDark } = useTheme();
  const { memberToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transparency, setTransparency] = useState<any>(null);

  const loadTransparencyData = async () => {
    if (!memberToken) return;
    try {
      const data = await api.getMemberTransparency(memberToken);
      setTransparency(data || { debts: [], own_consumption: 0, average_consumption: 0 });
    } catch (e) {
      console.error('Error loading resident transparency:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTransparencyData();
  }, [memberToken]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransparencyData();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const debts = transparency?.debts || [];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Consumption comparison */}
      <Card style={styles.metricsCard}>
        <View style={styles.metricsHeader}>
          <Flame size={20} color={colors.warning} />
          <Text style={[styles.metricsTitle, { color: colors.text }]}>Енергоефективність будинку</Text>
        </View>

        <View style={styles.comparisonContainer}>
          <View style={styles.comparisonCol}>
            <Text style={[styles.compLabel, { color: colors.textMuted }]}>Моє споживання</Text>
            <Text style={[styles.compVal, { color: colors.primary }]}>
              {transparency?.own_consumption || 0} м³ / кВт
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.comparisonCol}>
            <Text style={[styles.compLabel, { color: colors.textMuted }]}>Середнє по будинку</Text>
            <Text style={[styles.compVal, { color: colors.warning }]}>
              {transparency?.average_consumption || 0} м³ / кВт
            </Text>
          </View>
        </View>

        <View style={styles.gdprNotice}>
          <ShieldAlert size={14} color={colors.textMuted} />
          <Text style={[styles.gdprText, { color: colors.textMuted }]}>
            Дані споживання деперсоналізовані та зведені для захисту приватності.
          </Text>
        </View>
      </Card>

      {/* Debtors Registry header */}
      <View style={styles.sectionHeader}>
        <Users size={20} color={colors.primary} style={styles.sectionIcon} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Реєстр прозорості (Дошка боржників)</Text>
      </View>

      <Text style={[styles.introText, { color: colors.textMuted }]}>
        Публічний реєстр балансів об'єктів для покращення фінансової дисципліни. Дані надаються відповідно до ст. 21 ЗУ «Про ОСББ» та вимог GDPR (без ПІБ та контактів).
      </Text>

      {/* Debt list table */}
      <Card style={styles.tableCard}>
        <View style={[styles.tableHeader, { borderBottomColor: colors.cardBorder }]}>
          <Text style={[styles.headerCol, { color: colors.textMuted, flex: 1 }]}>№ Квартири/Об'єкта</Text>
          <Text style={[styles.headerCol, { color: colors.textMuted, textAlign: 'right', width: 120 }]}>Сума боргу</Text>
        </View>

        {debts.length > 0 ? (
          debts.map((item: any, index: number) => (
            <View 
              key={item.identifier || index} 
              style={[
                styles.tableRow, 
                { borderBottomColor: colors.cardBorder },
                index === debts.length - 1 && { borderBottomWidth: 0 }
              ]}
            >
              <Text style={[styles.rowCol, { color: colors.text }]}>
                Об'єкт № {item.identifier}
              </Text>
              <Text style={[styles.rowColValue, { color: '#f43f5e', width: 120 }]}>
                -{item.debt.toFixed(2)} грн
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Award size={36} color={colors.success} />
            <Text style={[styles.emptyText, { color: colors.success }]}>
              Боргів в організації немає. Дякуємо за вчасну оплату!
            </Text>
          </View>
        )}
      </Card>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricsCard: {
    padding: 16,
    marginBottom: 20,
  },
  metricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  metricsTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  comparisonCol: {
    flex: 1,
    alignItems: 'center',
  },
  compLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  compVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  divider: {
    width: 1,
    height: 40,
  },
  gdprNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  gdprText: {
    flex: 1,
    fontSize: 11,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  introText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  tableCard: {
    padding: 0,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: 1,
  },
  headerCol: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  rowCol: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  rowColValue: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
});
