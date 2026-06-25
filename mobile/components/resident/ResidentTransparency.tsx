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
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

  const toggleNode = (id: number) => {
    setExpandedNodes(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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
  const ownConsumption = transparency?.own_consumption || 0;
  const avgConsumption = transparency?.average_consumption || 0;
  const isSaving = ownConsumption <= avgConsumption;
  const differencePercent = avgConsumption > 0 
    ? Math.abs(Math.round(((avgConsumption - ownConsumption) / avgConsumption) * 100)) 
    : 0;

  const renderMeterNode = (meter: any, index: number, total: number, depth = 0) => {
    let children = meter.child_meters || [];
    if (transparency?.show_apartment_meters_in_transparency === false) {
      children = children.filter((c: any) => c.member_name === 'Сублічильник' || !c.member_name);
    }
    const hasChildren = children.length > 0;
    const isExpandedNode = expandedNodes[meter.id] || false;
    
    return (
      <View key={meter.id} style={styles.nodeContainer}>
        <Pressable 
          disabled={!hasChildren}
          onPress={() => toggleNode(meter.id)}
          style={[
            styles.meterRow, 
            depth === 0 ? styles.mainMeterNode : styles.childMeterNode,
            { 
              backgroundColor: depth === 0 ? colors.card : colors.inputBg,
              borderColor: depth === 0 ? colors.warning : colors.cardBorder,
              borderWidth: depth === 0 ? 1.5 : 1,
              borderRadius: 12,
            }
          ]}
        >
          {/* Horizontal tick connector for child nodes */}
          {depth > 0 && (
            <View style={[styles.horizontalTick, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} />
          )}

          <View style={[styles.iconCircle, { backgroundColor: depth === 0 ? colors.warningMuted : colors.primaryMuted }]}>
            {getMeterIcon(meter.type, depth === 0 ? colors.warning : colors.primary, 14)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.meterName, { color: colors.text, fontSize: depth === 0 ? 14 : 12 }]}>
              {meter.name}
            </Text>
            <Text style={[styles.meterSubText, { color: colors.textMuted }]}>
              {depth === 0 
                ? `Головний (${typeLabels[meter.type] || meter.type})` 
                : `${meter.member_identifier} (${meter.member_name})`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {hasChildren && !isExpandedNode && (
              <View style={{
                backgroundColor: colors.primaryMuted,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                  {children.length}
                </Text>
              </View>
            )}
            <View style={styles.valContainer}>
              <Text style={[styles.meterVal, { color: depth === 0 ? colors.warning : colors.primary, fontSize: depth === 0 ? 15 : 13 }]}>
                {meter.consumption.toFixed(2)}
              </Text>
              <Text style={[styles.meterUnit, { color: colors.textMuted }]}>
                {typeUnits[meter.type] || 'од.'}
              </Text>
            </View>
            {hasChildren && (
              <View style={{ 
                marginLeft: 4, 
                transform: [{ rotate: isExpandedNode ? '180deg' : '0deg' }] 
              }}>
                <ChevronDown size={14} color={colors.textMuted} />
              </View>
            )}
          </View>
        </Pressable>

        {hasChildren && isExpandedNode && (
          <View style={[
            styles.childrenWrapper, 
            { 
              borderLeftColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              borderLeftWidth: 1.5,
              marginLeft: 16,
              paddingLeft: 12,
            }
          ]}>
            {children.map((child: any, cIndex: number) => 
              renderMeterNode(child, cIndex, children.length, depth + 1)
            )}
          </View>
        )}
      </View>
    );
  };

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
          <View style={[styles.metricsIconCircle, { backgroundColor: colors.warningMuted }]}>
            <Flame size={20} color={colors.warning} />
          </View>
          <View>
            <Text style={[styles.metricsTitle, { color: colors.text }]}>Енергоефективність будинку</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>Аналітика та порівняння споживання</Text>
          </View>
        </View>

        <Text style={[styles.sectionSubtitle, { color: colors.text, marginBottom: 8 }]}>Моє споживання за місяць:</Text>
        {transparency?.own_consumption_by_type && Object.keys(transparency.own_consumption_by_type).length > 0 ? (
          Object.entries(transparency.own_consumption_by_type).map(([type, val]: [string, any]) => (
            <View key={type} style={styles.ownConsumptionRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {getMeterIcon(type, colors.primary, 15)}
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
          <Text style={{ color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginBottom: 12 }}>
            Немає активних лічильників
          </Text>
        )}

        {/* Comparison Progress Bar Gauge */}
        {avgConsumption > 0 && ownConsumption > 0 && (
          <View style={[styles.comparisonBlock, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
            <View style={styles.comparisonHeader}>
              <Text style={[styles.comparisonTitle, { color: colors.text }]}>Порівняння із середнім</Text>
              <Text style={[styles.comparisonSubtitle, { color: isSaving ? colors.success : colors.error }]}>
                {isSaving 
                  ? `менше на ${differencePercent}%` 
                  : `більше на ${differencePercent}%`}
              </Text>
            </View>
            
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${Math.min(100, (ownConsumption / avgConsumption) * 100)}%`,
                    backgroundColor: isSaving ? colors.success : colors.error 
                  }
                ]} 
              />
            </View>

            <View style={styles.comparisonLegend}>
              <Text style={[styles.legendText, { color: colors.textMuted }]}>
                Моє: <Text style={{ color: colors.text, fontWeight: 'bold' }}>{ownConsumption.toFixed(1)} кВт·год</Text>
              </Text>
              <Text style={[styles.legendText, { color: colors.textMuted }]}>
                Сер. по будинку: <Text style={{ color: colors.text, fontWeight: 'bold' }}>{avgConsumption.toFixed(1)} кВт·год</Text>
              </Text>
            </View>
          </View>
        )}

        <View style={styles.gdprNotice}>
          <ShieldAlert size={12} color={colors.textMuted} />
          <Text style={[styles.gdprText, { color: colors.textMuted }]}>
            Дані споживання деперсоналізовані та зведені для захисту приватності.
          </Text>
        </View>
      </Card>

      {/* Main & Child Meters List */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 12, marginBottom: 8 }]}>Загальнобудинкові лічильники</Text>
      {transparency?.main_meters && transparency.main_meters.length > 0 ? (
        transparency.main_meters.map((mainMeter: any, mIndex: number) => (
          <Card key={mainMeter.id} style={styles.meterCard}>
            {renderMeterNode(mainMeter, mIndex, transparency.main_meters.length, 0)}
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
    gap: 12,
  },
  metricsIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  // Premium visual hierarchy & tree connector styles
  nodeContainer: {
    position: 'relative',
    marginVertical: 4,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
  },
  mainMeterNode: {
    paddingVertical: 12,
  },
  childMeterNode: {
    paddingVertical: 8,
  },
  horizontalTick: {
    position: 'absolute',
    height: 1.5,
    width: 12,
    left: -12,
    top: 24,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meterName: {
    fontWeight: '700',
  },
  meterSubText: {
    fontSize: 10,
    marginTop: 2,
  },
  valContainer: {
    alignItems: 'flex-end',
  },
  meterVal: {
    fontWeight: '800',
  },
  meterUnit: {
    fontSize: 9,
    marginTop: 1,
  },
  childrenWrapper: {
    marginTop: 4,
  },
  comparisonBlock: {
    padding: 12,
    marginTop: 12,
    borderRadius: 12,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  comparisonTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  comparisonSubtitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(120, 120, 128, 0.12)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  comparisonLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendText: {
    fontSize: 11,
  },
});
