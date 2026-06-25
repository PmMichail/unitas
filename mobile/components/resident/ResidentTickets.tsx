import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  TextInput,
  RefreshControl,
  Modal,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { MessageSquarePlus, Send, CheckCircle2, Clock, Play } from 'lucide-react-native';

export default function ResidentTickets() {
  const { colors, isDark } = useTheme();
  const { memberToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  const loadTickets = async () => {
    if (!memberToken) return;
    try {
      const data = await api.getMemberTickets(memberToken);
      setTickets(data || []);
    } catch (e) {
      console.error('Error loading tickets:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [memberToken]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTickets();
  };

  const handleSubmitTicket = async () => {
    if (!titleInput.trim() || !descInput.trim()) {
      Alert.alert('Помилка', 'Будь ласка, заповніть тему та опис заявки.');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.createMemberTicket(memberToken!, {
        title: titleInput.trim(),
        description: descInput.trim(),
      });
      Alert.alert('Успішно', 'Вашу заявку успішно надіслано диспетчеру.');
      setTitleInput('');
      setDescInput('');
      loadTickets();
    } catch (e: any) {
      Alert.alert('Помилка', e.message || 'Не вдалося створити заявку.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusDetails = (status: string) => {
    // Trello-style workflow mapping: Прийнято -> В роботі -> Виконано
    switch (status) {
      case 'Done':
      case 'виконано':
      case 'Виконано':
        return {
          label: 'Виконано',
          color: colors.success,
          bgColor: colors.successMuted,
          icon: <CheckCircle2 size={14} color={colors.success} />,
        };
      case 'In Progress':
      case 'в роботі':
      case 'В роботі':
        return {
          label: 'В роботі',
          color: colors.warning,
          bgColor: colors.warningMuted,
          icon: <Play size={14} color={colors.warning} />,
        };
      case 'Accepted':
      case 'прийнято':
      case 'Прийнято':
      default:
        return {
          label: 'Прийнято',
          color: colors.primary,
          bgColor: colors.primaryMuted,
          icon: <Clock size={14} color={colors.primary} />,
        };
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Create Ticket Section */}
      <Card style={[styles.formCard, { borderColor: colors.warning, borderWidth: 1.5 }]}>
        <View style={styles.formHeader}>
          <MessageSquarePlus size={20} color={colors.primary} />
          <Text style={[styles.formTitle, { color: colors.text }]}>Диспетчер заявок</Text>
        </View>
        <Text style={[styles.formDesc, { color: colors.textMuted }]}>
          Повідомте адміністрацію про несправність або технічну проблему (наприклад, «Зламався шлагбаум», «Витік у підвалі»).
        </Text>

        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.inputBg }]}
          placeholder="Тема заявки..."
          placeholderTextColor={colors.textMuted + '80'}
          value={titleInput}
          onChangeText={setTitleInput}
        />
        <TextInput
          style={[styles.textarea, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.inputBg }]}
          placeholder="Детальний опис проблеми..."
          placeholderTextColor={colors.textMuted + '80'}
          value={descInput}
          onChangeText={setDescInput}
          multiline
          numberOfLines={4}
        />

        <Button
          title="Надіслати заявку"
          onPress={handleSubmitTicket}
          isLoading={submitting}
          style={styles.submitBtn}
        />
      </Card>

      {/* Tickets List Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Мої заявки</Text>
      
      {tickets.length > 0 ? (
        tickets.map((ticket) => {
          const statusDetail = getStatusDetails(ticket.status);
          return (
            <Pressable key={ticket.id} onPress={() => setSelectedTicket(ticket)}>
              <Card style={[styles.ticketCard, { borderColor: colors.warning, borderWidth: 1.5 }]}>
                <View style={styles.ticketHeader}>
                  <Text style={[styles.ticketTitle, { color: colors.text }]}>{ticket.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusDetail.bgColor }]}>
                    {statusDetail.icon}
                    <Text style={[styles.statusText, { color: statusDetail.color }]}>
                      {statusDetail.label}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.ticketDesc, { color: colors.textMuted }]}>
                  {ticket.description}
                </Text>
              </Card>
            </Pressable>
          );
        })
      ) : (
        <Card style={[styles.emptyCard, { borderColor: colors.warning, borderWidth: 1.5 }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            У вас немає активних заявок.
          </Text>
        </Card>
      )}

      <Modal
        visible={selectedTicket !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedTicket(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.warning, borderWidth: 1.5 }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedTicket?.title}</Text>
            
            <ScrollView style={styles.modalScroll}>
              <Text style={[styles.modalDescLabel, { color: colors.textMuted }]}>Опис проблеми:</Text>
              <Text style={[styles.modalDescText, { color: colors.text }]}>{selectedTicket?.description}</Text>
              
              <Text style={[styles.modalTimelineLabel, { color: colors.textMuted }]}>Статус виконання:</Text>
              <View style={styles.timelineContainer}>
                {/* Step 1: Created */}
                <View style={styles.timelineRow}>
                  <View style={styles.timelineDotContainer}>
                    <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                    <View style={[styles.timelineLine, { backgroundColor: selectedTicket?.status === 'in_progress' || selectedTicket?.status === 'В роботі' || selectedTicket?.status === 'done' || selectedTicket?.status === 'Виконано' || selectedTicket?.status === 'виконано' ? colors.primary : colors.cardBorder }]} />
                  </View>
                  <View style={styles.timelineTextContainer}>
                    <Text style={[styles.timelineStepTitle, { color: colors.text }]}>📅 Створено</Text>
                    <Text style={[styles.timelineStepDesc, { color: colors.textMuted }]}>Заявку прийнято диспетчером</Text>
                  </View>
                </View>

                {/* Step 2: In Progress */}
                <View style={styles.timelineRow}>
                  <View style={styles.timelineDotContainer}>
                    <View style={[styles.timelineDot, { backgroundColor: selectedTicket?.status === 'in_progress' || selectedTicket?.status === 'В роботі' || selectedTicket?.status === 'done' || selectedTicket?.status === 'Виконано' || selectedTicket?.status === 'виконано' ? colors.warning : colors.cardBorder }]} />
                    <View style={[styles.timelineLine, { backgroundColor: selectedTicket?.status === 'done' || selectedTicket?.status === 'Виконано' || selectedTicket?.status === 'виконано' ? colors.warning : colors.cardBorder }]} />
                  </View>
                  <View style={styles.timelineTextContainer}>
                    <Text style={[styles.timelineStepTitle, { color: colors.text }]}>⚙️ В роботі</Text>
                    <Text style={[styles.timelineStepDesc, { color: colors.textMuted }]}>Виконавець працює над заявкою</Text>
                  </View>
                </View>

                {/* Step 3: Completed or Rejected */}
                {selectedTicket?.status === 'rejected' || selectedTicket?.status === 'Відхилено' || selectedTicket?.status === 'відхилено' ? (
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineDotContainer}>
                      <View style={[styles.timelineDot, { backgroundColor: colors.error || '#ef4444' }]} />
                    </View>
                    <View style={styles.timelineTextContainer}>
                      <Text style={[styles.timelineStepTitle, { color: colors.error || '#ef4444' }]}>❌ Відхилено</Text>
                      <Text style={[styles.timelineStepDesc, { color: colors.textMuted }]}>Заявку відхилено адміністрацією</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineDotContainer}>
                      <View style={[styles.timelineDot, { backgroundColor: selectedTicket?.status === 'done' || selectedTicket?.status === 'Виконано' || selectedTicket?.status === 'виконано' ? colors.success : colors.cardBorder }]} />
                    </View>
                    <View style={styles.timelineTextContainer}>
                      <Text style={[styles.timelineStepTitle, { color: colors.text }]}>✅ Виконано</Text>
                      <Text style={[styles.timelineStepDesc, { color: colors.textMuted }]}>Роботи успішно завершено</Text>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            <Button
              title="Закрити"
              onPress={() => setSelectedTicket(null)}
              style={styles.modalCloseBtn}
            />
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formCard: {
    padding: 16,
    marginBottom: 24,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  formDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  textarea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    fontSize: 15,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  submitBtn: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  ticketCard: {
    padding: 16,
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  ticketDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalDescLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalDescText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalTimelineLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  timelineContainer: {
    paddingLeft: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDotContainer: {
    alignItems: 'center',
    marginRight: 16,
    width: 20,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  timelineTextContainer: {
    flex: 1,
    paddingTop: 0,
  },
  timelineStepTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  timelineStepDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    marginTop: 10,
  },
});
