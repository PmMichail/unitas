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
      <Card style={styles.formCard}>
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
            <Card key={ticket.id} style={styles.ticketCard}>
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
          );
        })
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            У вас немає активних заявок.
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
});
