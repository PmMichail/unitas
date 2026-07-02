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
  Modal,
  TextInput,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { BarChart3, CheckCircle2, Info, Shield, X, Check } from 'lucide-react-native';

export default function ResidentSurveys() {
  const { colors } = useTheme();
  const { memberToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Tabs: 'surveys' | 'meetings'
  const [activeSubTab, setActiveSubTab] = useState<'surveys' | 'meetings'>('surveys');

  // Surveys State
  const [surveys, setSurveys] = useState<any[]>([]);
  const [votingSurveyId, setVotingSurveyId] = useState<number | null>(null);

  // General Meetings State
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, Record<number, string>>>({});
  const [votingMeetingId, setVotingMeetingId] = useState<number | null>(null);
  const [showMockSignature, setShowMockSignature] = useState<'diia' | 'privat' | null>(null);
  const [votingPassword, setVotingPassword] = useState('');
  const [isCastingVote, setIsCastingVote] = useState(false);

  const loadSurveys = async () => {
    if (!memberToken) return;
    try {
      const data = await api.getMemberSurveys(memberToken);
      setSurveys(data || []);
    } catch (e) {
      console.error('Error loading resident surveys:', e);
    }
  };

  const loadMeetings = async () => {
    if (!memberToken) return;
    try {
      const data = await api.getMemberMeetings(memberToken);
      setMeetings(data || []);
    } catch (e) {
      console.error('Error loading resident meetings:', e);
    }
  };

  const loadData = async () => {
    if (!memberToken) return;
    try {
      await Promise.all([loadSurveys(), loadMeetings()]);
    } catch (e) {
      console.error('Error loading resident data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [memberToken]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Vote on standard survey
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

  // Cast General Meeting Vote with Signature
  const handleCastMeetingVote = async (meetingId: number, method: 'kep' | 'diia' | 'privat') => {
    const answers = selectedAnswers[meetingId] || {};
    
    if (method === 'kep' && !votingPassword) {
      Alert.alert('Помилка', 'Будь ласка, введіть пароль для підпису.');
      return;
    }

    try {
      setIsCastingVote(true);
      const signatureInfo = {
        method,
        timestamp: new Date().toISOString(),
        cert_serial: method === 'kep' ? 'UA-85472910-KEP' : `UA-${method.toUpperCase()}-MOCK`,
        cert_owner: 'Співвласник ОСББ',
      };

      await api.voteMemberMeeting(memberToken!, meetingId, answers, signatureInfo);
      
      Alert.alert('Успішно', 'Ваш підписаний голос успішно зараховано.');
      setVotingMeetingId(null);
      setVotingPassword('');
      setShowMockSignature(null);
      loadMeetings();
    } catch (e: any) {
      Alert.alert('Помилка', e.message || 'Не вдалося проголосувати.');
    } finally {
      setIsCastingVote(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const voteLabels: Record<string, string> = { for: 'За', against: 'Проти', abstain: 'Утримався', yes: 'За', no: 'Проти' };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Sub-tab Selection Header */}
      <View style={[styles.tabBar, { borderBottomColor: colors.cardBorder }]}>
        <Pressable
          style={[styles.tabItem, activeSubTab === 'surveys' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveSubTab('surveys')}
        >
          <Text style={[styles.tabText, { color: activeSubTab === 'surveys' ? colors.primary : colors.textMuted }]}>
            🗳️ Опитування ({surveys.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabItem, activeSubTab === 'meetings' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveSubTab('meetings')}
        >
          <Text style={[styles.tabText, { color: activeSubTab === 'meetings' ? colors.primary : colors.textMuted }]}>
            🏛️ Загальні збори ({meetings.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {activeSubTab === 'surveys' ? (
          <>
            <View style={styles.sectionHeader}>
              <BarChart3 size={20} color={colors.primary} style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Загальні опитування будинку</Text>
            </View>

            <Text style={[styles.introText, { color: colors.textMuted }]}>
              Ваш голос розраховується пропорційно до площі вашої власності (м²). Для прийняття законних рішень необхідний кворум 50% + 1 від загальної площі будинку.
            </Text>

            {surveys.length > 0 ? (
              surveys.map((survey) => (
                <Card key={survey.id} style={[styles.surveyCard, { borderColor: colors.warning, borderWidth: 1.5 }]}>
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
              <Card style={[styles.emptyCard, { borderColor: colors.warning, borderWidth: 1.5 }]}>
                <Info size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Наразі немає активних загальних опитувань мешканців.
                </Text>
              </Card>
            )}
          </>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Shield size={20} color={colors.primary} style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Загальні збори (Електронне голосування)</Text>
            </View>

            <Text style={[styles.introText, { color: colors.textMuted }]}>
              Офіційне голосування згідно закону про ОСББ. Голос розраховується пропорційно площі приміщення власника. Вхід та голосування вимагають цифрового підтвердження (КЕП, Дія, Приват).
            </Text>

            {meetings.length > 0 ? (
              meetings.map((meeting) => (
                <Card key={meeting.id} style={styles.surveyCard}>
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            meeting.status === 'discussion'
                              ? '#e0f2fe'
                              : meeting.status === 'voting'
                              ? '#fef3c7'
                              : '#d1fae5',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          {
                            color:
                              meeting.status === 'discussion'
                                ? '#0369a1'
                                : meeting.status === 'voting'
                                ? '#b45309'
                                : '#047857',
                          },
                        ]}
                      >
                        {meeting.status === 'discussion'
                          ? 'Обговорення'
                          : meeting.status === 'voting'
                          ? 'Голосування'
                          : 'Завершено'}
                      </Text>
                    </View>
                    {meeting.has_voted && (
                      <Text style={[styles.votedBadgeText, { color: colors.success }]}>
                        ✓ Ваш голос зараховано
                      </Text>
                    )}
                  </View>

                  <Text style={[styles.surveyTitle, { color: colors.text, marginTop: 8 }]}>{meeting.title}</Text>
                  {meeting.description ? (
                    <Text style={[styles.surveyDesc, { color: colors.textMuted }]}>{meeting.description}</Text>
                  ) : null}

                  {meeting.start_date && (
                    <Text style={[styles.dateText, { color: colors.textMuted }]}>
                      📅 {meeting.start_date} — {meeting.end_date}
                    </Text>
                  )}

                  {/* Voting fields for active meeting */}
                  {meeting.status === 'voting' && !meeting.has_voted ? (
                    <View style={styles.meetingQuestionsContainer}>
                      {meeting.questions.map((q: any, qIdx: number) => (
                        <View key={q.id} style={[styles.questionBox, { backgroundColor: colors.inputBg }]}>
                          <Text style={[styles.questionText, { color: colors.text }]}>
                            {qIdx + 1}. {q.question_text}
                          </Text>
                          <View style={styles.voteContainer}>
                            {['yes', 'no', 'abstain'].map((val) => {
                              const isActive = selectedAnswers[meeting.id]?.[q.id] === val;
                              return (
                                <Pressable
                                  key={val}
                                  style={[
                                    styles.voteButton,
                                    { backgroundColor: colors.background, borderColor: colors.cardBorder },
                                    isActive && { backgroundColor: colors.primary, borderColor: colors.primary }
                                  ]}
                                  onPress={() => {
                                    setSelectedAnswers(prev => {
                                      const meetingAns = prev[meeting.id] || {};
                                      return {
                                        ...prev,
                                        [meeting.id]: {
                                          ...meetingAns,
                                          [q.id]: val
                                        }
                                      };
                                    });
                                  }}
                                >
                                  <Text 
                                    style={[
                                      styles.voteButtonText, 
                                      { color: colors.text },
                                      isActive && { color: '#ffffff', fontWeight: 'bold' }
                                    ]}
                                  >
                                    {val === 'yes' ? 'За' : val === 'no' ? 'Проти' : 'Утримався'}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      ))}

                      <Button
                        title="Накласти підпис та проголосувати"
                        onPress={() => {
                          const answers = selectedAnswers[meeting.id] || {};
                          if (Object.keys(answers).length < meeting.questions.length) {
                            Alert.alert('Увага', 'Будь ласка, оберіть відповіді на всі питання порядку денного.');
                            return;
                          }
                          setVotingMeetingId(meeting.id);
                        }}
                        style={{ marginTop: 12 }}
                      />
                    </View>
                  ) : meeting.status === 'voting' && meeting.has_voted ? (
                    <View style={styles.votedBadge}>
                      <CheckCircle2 size={16} color={colors.success} />
                      <Text style={[styles.votedBadgeText, { color: colors.success, fontSize: 13 }]}>
                        Ви успішно проголосували з накладанням ЕЦП.
                      </Text>
                    </View>
                  ) : meeting.status === 'completed' ? (
                    <View style={[styles.questionBox, { backgroundColor: colors.inputBg, marginTop: 12 }]}>
                      <Text style={[styles.questionText, { color: colors.text, fontWeight: 'bold' }]}>
                        📄 Збори завершено. Протокол підписано та опубліковано.
                      </Text>
                      <Text style={[styles.surveyDesc, { color: colors.textMuted, marginTop: 4, marginBottom: 0 }]}>
                        Ознайомитись з протоколом можна у вкладці "Документи".
                      </Text>
                    </View>
                  ) : null}
                </Card>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <Info size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Наразі немає активних або завершених загальних зборів.
                </Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>

      {/* Signature Selector Modal */}
      <Modal
        visible={votingMeetingId !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setVotingMeetingId(null);
          setVotingPassword('');
          setShowMockSignature(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Цифровий підпис</Text>
              <Pressable
                onPress={() => {
                  setVotingMeetingId(null);
                  setVotingPassword('');
                  setShowMockSignature(null);
                }}
              >
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            {!showMockSignature ? (
              <View style={styles.modalBody}>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>
                  Оберіть метод підтвердження особи та підписання бюлетеня:
                </Text>

                <Pressable
                  style={[styles.signatureOption, { backgroundColor: colors.inputBg }]}
                  onPress={() => setShowMockSignature('diia')}
                >
                  <Text style={[styles.optionTitle, { color: colors.text }]}>Дія.Підпис</Text>
                  <Text style={[styles.optionDesc, { color: colors.textMuted }]}>Авторизація через державний додаток Дія</Text>
                </Pressable>

                <Pressable
                  style={[styles.signatureOption, { backgroundColor: colors.inputBg }]}
                  onPress={() => setShowMockSignature('privat')}
                >
                  <Text style={[styles.optionTitle, { color: colors.text }]}>Приват24 / PrivatID</Text>
                  <Text style={[styles.optionDesc, { color: colors.textMuted }]}>Підтвердження за допомогою OTP коду</Text>
                </Pressable>

                <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

                <Text style={[styles.modalLabel, { color: colors.text, fontWeight: 'bold', marginTop: 12 }]}>
                  Або введіть пароль для власного КЕП
                </Text>
                <TextInput
                  secureTextEntry
                  placeholder="Пароль КЕП сертифіката..."
                  placeholderTextColor={colors.textMuted}
                  value={votingPassword}
                  onChangeText={setVotingPassword}
                  style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]}
                />
                
                <Button
                  title={isCastingVote ? "Підписання..." : "Підписати КЕП"}
                  onPress={() => handleCastMeetingVote(votingMeetingId!, 'kep')}
                  disabled={isCastingVote}
                  style={{ marginTop: 12 }}
                />
              </View>
            ) : showMockSignature === 'diia' ? (
              <View style={styles.modalBody}>
                <View style={styles.qrSimulator}>
                  <Text style={{ fontSize: 24, fontWeight: 'black', color: '#000000' }}>Дія</Text>
                  <Text style={{ fontSize: 10, color: '#666666', marginTop: 4 }}>QR-код авторизації</Text>
                </View>
                <Text style={[styles.optionDesc, { color: colors.textMuted, textAlign: 'center', marginVertical: 12 }]}>
                  Зіскануйте QR-код або перейдіть у додаток Дія для підтвердження підпису.
                </Text>
                <Button
                  title={isCastingVote ? "Перевірка..." : "Імітувати успішне підписання Дія.Підпис"}
                  onPress={() => handleCastMeetingVote(votingMeetingId!, 'diia')}
                  disabled={isCastingVote}
                />
              </View>
            ) : (
              <View style={styles.modalBody}>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>
                  Вам надіслано одноразовий SMS-код у додаток Privat24:
                </Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder="Код із повідомлення (напр. 1938)"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder, textAlign: 'center', fontSize: 18, fontWeight: 'bold' }]}
                  defaultValue="1938"
                />
                <Button
                  title={isCastingVote ? "Підтвердження..." : "Імітувати верифікацію Приват24"}
                  onPress={() => handleCastMeetingVote(votingMeetingId!, 'privat')}
                  disabled={isCastingVote}
                  style={{ marginTop: 12 }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
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
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  surveyCard: {
    padding: 16,
    marginBottom: 16,
  },
  surveyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  surveyDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
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
  meetingQuestionsContainer: {
    marginTop: 12,
    gap: 12,
  },
  questionBox: {
    padding: 12,
    borderRadius: 12,
  },
  questionText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalBody: {
    gap: 12,
  },
  modalLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  signatureOption: {
    padding: 14,
    borderRadius: 14,
    gap: 4,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 11,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 13,
  },
  qrSimulator: {
    width: 140,
    height: 140,
    backgroundColor: '#ffffff',
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
