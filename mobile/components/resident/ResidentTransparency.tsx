import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../ui/Card';
import { api } from '../../services/api';
import { ShieldAlert, Users, Award, Flame, ChevronDown, Home, Zap, Droplet } from 'lucide-react-native';

const typeLabels: Record<string, string> = {
  electricity: 'Електроенергія',
  water: 'Водопостачання',
  gas: 'Газопостачання',
  heat: 'Опалення',
};

const typeUnits: Record<string, string> = {
  electricity: 'кВт·год/міс',
  water: 'м³/міс',
  gas: 'м³/міс',
  heat: 'Гкал/міс',
};

export default function ResidentTransparency() {
  const { colors, isDark } = useTheme();
  const { memberToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transparency, setTransparency] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const getMeterIcon = (type: string, color: string, size = 18) => {
    switch (type) {
      case 'electricity':
        return <Zap size={size} color={color} />;
      case 'water':
        return <Droplet size={size} color={color} />;
      case 'gas':
      case 'heat':
      default:
        return <Flame size={size} color={color} />;
    }
  };

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
      <Card style={[styles.metricsCard, { borderColor: colors.warning, borderWidth: 1.5 }]}>
        <View style={styles.metricsHeader}>
          <Flame size={20} color={colors.warning} />
          <Text style={[styles.metricsTitle, { color: colors.text }]}>Енергоефективність будинку</Text>
        </View>

        <Text style={[styles.sectionSubtitle, { color: colors.text, marginBottom: 8 }]}>Моє споживання за місяць:</Text>
        {transparency?.own_consumption_by_type && Object.keys(transparency.own_consumption_by_type).length > 0 ? (
          Object.entries(transparency.own_consumption_by_type).map(([type, val]: [string, any]) => (
            <View key={type} style={styles.ownConsumptionRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {getMeterIcon(type, colors.primary, 16)}
                <Text style={[styles.ownConsumptionLabel, { color: colors.text }]}>
                  {typeLabels[type] || type}
                </Text>
              </View>
              <Text style={[styles.ownConsumptionVal, { color: colors.primary }]}>
                {val.toFixed(2)} {typeUnits[type] || 'од.'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 13, fontStyle: 'italic', marginBottom: 12 }}>
            Немає активних лічильників
          </Text>
        )}

        <View style={styles.gdprNotice}>
          <ShieldAlert size={14} color={colors.textMuted} />
          <Text style={[styles.gdprText, { color: colors.textMuted }]}>
            Дані споживання деперсоналізовані та зведені для захисту приватності.
          </Text>
        </View>
      </Card>

      {/* Main & Child Meters List */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 12 }]}>Загальнобудинкові лічильники</Text>
      {transparency?.main_meters && transparency.main_meters.length > 0 ? (
        transparency.main_meters.map((mainMeter: any) => (
          <Card key={mainMeter.id} style={[styles.meterCard, { borderColor: colors.warning, borderWidth: 1.5 }]}>
            <View style={styles.mainMeterRow}>
              <View style={[styles.mainMeterIconContainer, { backgroundColor: colors.warningMuted }]}>
                {getMeterIcon(mainMeter.type, colors.warning, 18)}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.mainMeterName, { color: colors.text }]}>{mainMeter.name}</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  Головний лічильник ({typeLabels[mainMeter.type] || mainMeter.type})
                </Text>
              </View>
              <View style={styles.mainMeterValContainer}>
                <Text style={[styles.mainMeterVal, { color: colors.warning }]}>
                  {mainMeter.consumption.toFixed(2)}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textMuted }}>
                  {typeUnits[mainMeter.type] || 'од.'}
                </Text>
              </View>
            </View>

            {mainMeter.child_meters && mainMeter.child_meters.length > 0 && (
              <View style={[styles.childMetersContainer, { borderTopColor: colors.cardBorder }]}>
                <Text style={[styles.childTitle, { color: colors.text }]}>Підпорядковані лічильники мешканців:</Text>
                {mainMeter.child_meters.map((child: any) => (
                  <View key={child.id} style={styles.childMeterRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.childMeterName, { color: colors.text }]}>
                        {child.member_identifier} ({child.member_name})
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        {child.name}
                      </Text>
                    </View>
                    <View style={styles.childMeterValContainer}>
                      <Text style={[styles.childMeterVal, { color: colors.primary }]}>
                        {child.consumption.toFixed(2)}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textMuted, marginLeft: 4 }}>
                        {typeUnits[child.type] || 'од.'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        ))
      ) : (
        <Card style={[styles.emptyCard, { borderColor: colors.warning, borderWidth: 1.5, marginBottom: 12 }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Головні лічильники не налаштовані.
          </Text>
        </Card>
      )}

      {/* Expandable Transparency Registry Block */}
      <Pressable onPress={() => setIsExpanded(!isExpanded)}>
        <Card style={[styles.expandableHeaderCard, { borderColor: colors.warning, borderWidth: 1.5 }]}>
          <View style={styles.expandableHeaderRow}>
            <View style={[styles.expandableIconCircle, { backgroundColor: colors.primaryMuted }]}>
              <Users size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.expandableTitle, { color: colors.text }]}>Реєстр прозорості</Text>
              <Text style={[styles.expandableSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {isExpanded ? 'Натисніть, щоб згорнути реєстр' : 'Натисніть, щоб відкрити список боржників'}
              </Text>
            </View>
            <View style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
              <ChevronDown size={20} color={colors.textMuted} />
            </View>
          </View>
        </Card>
      </Pressable>

      {isExpanded && (
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.introText, { color: colors.textMuted, marginBottom: 12 }]}>
            Публічний реєстр балансів об'єктів для покращення фінансової дисципліни. Дані надаються відповідно до ст. 21 ЗУ «Про ОСББ» та вимог GDPR (без ПІБ та контактів).
          </Text>

          <Card style={[styles.tableCard, { borderColor: colors.warning, borderWidth: 1.5, padding: 0 }]}>
            {debts.length > 0 ? (
              <View style={{ paddingVertical: 4 }}>
                <View style={[styles.summaryBadge, { backgroundColor: colors.inputBg }]}>
                  <Text style={[styles.summaryBadgeText, { color: colors.text }]}>
                    Всього об'єктів із заборгованістю: <Text style={{ fontWeight: 'bold', color: colors.primary }}>{debts.length}</Text>
                  </Text>
                </View>

                {debts.map((item: any, index: number) => (
                  <View 
                    key={item.identifier || index} 
                    style={[
                      styles.modernTableRow, 
                      { borderBottomColor: colors.cardBorder },
                      index === debts.length - 1 && { borderBottomWidth: 0 }
                    ]}
                  >
                    <View style={[styles.rowIconContainer, { backgroundColor: colors.primaryMuted }]}>
                      <Home size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.objectIdentifierText, { color: colors.text }]}>
                        {item.identifier.startsWith('вул.') || item.identifier.startsWith('кв.') 
                          ? item.identifier 
                          : `Об'єкт № ${item.identifier}`}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                        Статус: Наявний борг
                      </Text>
                    </View>
                    <View style={[styles.debtBadge, { backgroundColor: isDark ? 'rgba(244, 63, 94, 0.12)' : '#fff1f2' }]}>
                      <Text style={[styles.debtBadgeText, { color: isDark ? '#fb7185' : '#e11d48' }]}>
                        -{item.debt.toFixed(2)} грн
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Award size={36} color={colors.success} />
                <Text style={[styles.emptyText, { color: colors.success }]}>
                  Боргів в організації немає. Дякуємо за вчасну оплату!
                </Text>
              </View>
            )}
          </Card>
        </View>
      )}
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
  expandableHeaderCard: {
    padding: 16,
    marginBottom: 12,
  },
  expandableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expandableIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandableTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  expandableSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  summaryBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 14,
    marginVertical: 12,
    alignSelf: 'flex-start',
  },
  summaryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modernTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  rowIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  objectIdentifierText: {
    fontSize: 14,
    fontWeight: '600',
  },
  debtBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  debtBadgeText: {
    fontSize: 13,
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
  ownConsumptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  ownConsumptionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  ownConsumptionVal: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  meterCard: {
    padding: 16,
    marginBottom: 12,
  },
  mainMeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mainMeterIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainMeterName: {
    fontSize: 14,
    fontWeight: '700',
  },
  mainMeterValContainer: {
    alignItems: 'flex-end',
  },
  mainMeterVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  childMetersContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  childTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  childMeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  childMeterName: {
    fontSize: 13,
    fontWeight: '600',
  },
  childMeterValContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childMeterVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
});
