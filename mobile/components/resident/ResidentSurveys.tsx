import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { BarChart3, CheckCircle2, Info } from 'lucide-react-native';

export default function ResidentSurveys() {
  const { colors } = useTheme();
  const { memberToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [votingSurveyId, setVotingSurveyId] = useState<number | null>(null);

  const loadSurveys = async () => {
    if (!memberToken) return;
    try {
      const data = await api.getMemberSurveys(memberToken);
      setSurveys(data || []);
    } catch (e) {
      console.error('Error loading resident surveys:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, [memberToken]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSurveys();
  };

  const handleVote = async (surveyId: number, voteValue: 'for' | 'against' | 'abstain') => {
    try {
      setVotingSurveyId(surveyId);
      await api.voteMemberSurvey(memberToken!, surveyId, {
        vote: voteValue,
      });
      Alert.alert('Успішно', 'Ваш голос враховано.');
      loadSurveys();
    } catch (e: any) {
      Alert.alert('Помилка', e.message || 'Не вдалося проголосувати.');
    } finally {
      setVotingSurveyId(null);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const voteLabels: Record<string, string> = { for: 'За', against: 'Проти', abstain: 'Утримався' };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.sectionHeader}>
        <BarChart3 size={20} color={colors.primary} style={styles.sectionIcon} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Опитування та голосування</Text>
      </View>

      <Text style={[styles.introText, { color: colors.textMuted }]}>
        Ваш голос розраховується пропорційно до площі вашої власності (м²). Для прийняття законних рішень необхідний кворум 50% + 1 від загальної площі будинку.
      </Text>

      {surveys.length > 0 ? (
        surveys.map((survey) => (
          <Card key={survey.id} style={styles.surveyCard}>
            <Text style={[styles.surveyTitle, { color: colors.text }]}>{survey.title}</Text>
            {survey.description ? (
              <Text style={[styles.surveyDesc, { color: colors.textMuted }]}>{survey.description}</Text>
            ) : null}

            {/* Quorum Progress Bar */}
            <View style={styles.quorumRow}>
              <Text style={[styles.quorumLabel, { color: colors.textMuted }]}>
                Зібрано голосів: {survey.quorum_percent?.toFixed(1)}%
              </Text>
              <Text style={[styles.quorumLabel, { color: colors.textMuted }]}>
                Кворум: 50%
              </Text>
            </View>

            <View style={[styles.progressBarBg, { backgroundColor: colors.inputBg }]}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    backgroundColor: survey.quorum_percent >= 50 ? colors.success : colors.primary,
                    width: `${Math.min(100, survey.quorum_percent)}%` 
                  }
                ]} 
              />
            </View>

            {/* Vote Action Buttons */}
            <View style={styles.voteContainer}>
              {(['for', 'against', 'abstain'] as const).map((value) => {
                const isActive = survey.own_vote === value;
                return (
                  <Pressable
                    key={value}
                    style={[
                      styles.voteButton,
                      { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                      isActive && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => handleVote(survey.id, value)}
                    disabled={votingSurveyId === survey.id}
                  >
                    <Text 
                      style={[
                        styles.voteButtonText, 
                        { color: colors.text },
                        isActive && { color: '#ffffff', fontWeight: 'bold' }
                      ]}
                    >
                      {voteLabels[value]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {survey.own_vote ? (
              <View style={styles.votedBadge}>
                <CheckCircle2 size={14} color={colors.success} />
                <Text style={[styles.votedBadgeText, { color: colors.success }]}>
                  Ви вже проголосували: "{voteLabels[survey.own_vote]}"
                </Text>
              </View>
            ) : null}
          </Card>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Info size={32} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Наразі немає активних загальних опитувань мешканців.
          </Text>
        </Card>
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
  surveyCard: {
    padding: 16,
    marginBottom: 16,
  },
  surveyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  surveyDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  quorumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  quorumLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  voteContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  voteButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  votedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 6,
  },
  votedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
