import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  Modal,
  Alert,
  Pressable,
  Switch,
  ActivityIndicator,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Dimensions,
  useWindowDimensions,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { api, ProfileData } from '../../services/api';
import { haptics } from '../../services/haptics';
import { Plus, Briefcase, Trash2, Edit3, X, UserCheck, Users, Percent, Coins, FileText, Calendar, Mail, Send, CheckCircle2 } from 'lucide-react-native';

export default function ProfilesScreen() {
  const { colors } = useTheme();
  const { telegramId } = useAuth();
  const insets = useSafeAreaInsets();
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
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ProfileData | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [type, setType] = useState<'fop' | 'company'>('fop');
  const [taxSystem, setTaxSystem] = useState('single_tax');
  const [group, setGroup] = useState(3);
  const [rate, setRate] = useState(5);
  const [hasEmployees, setHasEmployees] = useState(false);
  const [isVatPayer, setIsVatPayer] = useState(false);
  const [isDirector, setIsDirector] = useState(true);
  const [address, setAddress] = useState('');
  const [invClientAddress, setInvClientAddress] = useState('');
  const [oneoffClientAddress, setOneoffClientAddress] = useState('');
  const [calculationStartDate, setCalculationStartDate] = useState('');
  const [startingDebtEdp, setStartingDebtEdp] = useState('');
  const [startingDebtEsv, setStartingDebtEsv] = useState('');
  const [startingDebtVz, setStartingDebtVz] = useState('');
  const [startingDebtPdfo, setStartingDebtPdfo] = useState('');

  // Employee Modal State
  const [employeesModalVisible, setEmployeesModalVisible] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeFormVisible, setEmployeeFormVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);

  // Employee Form State
  const [empName, setEmpName] = useState('');
  const [empTaxId, setEmpTaxId] = useState('');
  const [empSalary, setEmpSalary] = useState('');

  // Invoices & Acts Modal States
  const [invoicesModalVisible, setInvoicesModalVisible] = useState(false);
  const [recurringInvoices, setRecurringInvoices] = useState<any[]>([]);
  const [invoicesHistory, setInvoicesHistory] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  
  // Invoice form state
  const [invoiceFormVisible, setInvoiceFormVisible] = useState(false);
  const [invClientEmail, setInvClientEmail] = useState('');
  const [invClientTg, setInvClientTg] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invServiceName, setInvServiceName] = useState('');
  const [invSendDay, setInvSendDay] = useState('1');
  const [invIncludeAct, setInvIncludeAct] = useState(true);
  const [invPeriodicity, setInvPeriodicity] = useState<'monthly' | 'specific'>('monthly');
  const [invSendMonth, setInvSendMonth] = useState<number | null>(null);
  const [invClientName, setInvClientName] = useState('');
  const [invClientTaxId, setInvClientTaxId] = useState('');
  const [invDocumentType, setInvDocumentType] = useState('act');
  const [invActiveTab, setInvActiveTab] = useState<'schedules' | 'oneoff' | 'history'>('schedules');
  
  // One-off invoice form state
  const [oneoffClientEmail, setOneoffClientEmail] = useState('');
  const [oneoffClientTg, setOneoffClientTg] = useState('');
  const [oneoffAmount, setOneoffAmount] = useState('');
  const [oneoffServiceName, setOneoffServiceName] = useState('');
  const [oneoffIncludeAct, setOneoffIncludeAct] = useState(true);
  const [oneoffClientName, setOneoffClientName] = useState('');
  const [oneoffClientTaxId, setOneoffClientTaxId] = useState('');
  const [oneoffDocumentType, setOneoffDocumentType] = useState('act');

  // Send invoice confirmation modal states
  const [sendConfirmModalVisible, setSendConfirmModalVisible] = useState(false);
  const [targetInvoiceId, setTargetInvoiceId] = useState<number | null>(null);
  const [customDateEnabled, setCustomDateEnabled] = useState(false);
  const [customSendDay, setCustomSendDay] = useState('');
  const [customSendMonth, setCustomSendMonth] = useState('');
  const [sendIncludeAct, setSendIncludeAct] = useState(true);

  // Support Chat States
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [supportChatProfile, setSupportChatProfile] = useState<ProfileData | null>(null);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [supportInputText, setSupportInputText] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);

  const fetchSupportMessages = async (profileId: number) => {
    try {
      const msgs = await api.getSupportMessages(profileId);
      setSupportMessages(msgs);
    } catch (e) {
      console.error("Failed to fetch support messages:", e);
    }
  };

  const handleOpenSupportChat = (profile: ProfileData) => {
    setSupportChatProfile(profile);
    setSupportInputText('');
    setSupportMessages([]);
    setSupportModalVisible(true);
    fetchSupportMessages(profile.id);
  };

  const handleSendSupportMessage = async () => {
    if (!supportInputText.trim() || !supportChatProfile || sendingSupport) return;
    const txt = supportInputText.trim();
    setSupportInputText('');
    setSendingSupport(true);
    try {
      await api.sendSupportMessage(supportChatProfile.id, txt);
      await fetchSupportMessages(supportChatProfile.id);
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалося надіслати повідомлення');
    } finally {
      setSendingSupport(false);
    }
  };

  useEffect(() => {
    if (!supportModalVisible || !supportChatProfile) return;
    const interval = setInterval(() => {
      fetchSupportMessages(supportChatProfile.id);
    }, 4000);
    return () => clearInterval(interval);
  }, [supportModalVisible, supportChatProfile]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    if (!telegramId) return;
    setLoading(true);
    try {
      const data = await api.getProfiles(telegramId);
      setProfiles(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити податкові профілі');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setTaxId('');
    setType('fop');
    setTaxSystem('single_tax');
    setGroup(3);
    setRate(5);
    setHasEmployees(false);
    setIsVatPayer(false);
    setIsDirector(true);
    setAddress('');
    setCalculationStartDate('');
    setStartingDebtEdp('');
    setStartingDebtEsv('');
    setStartingDebtVz('');
    setStartingDebtPdfo('');
    setEditingProfile(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setModalVisible(true);
  };

  const handleOpenEdit = (profile: ProfileData) => {
    setEditingProfile(profile);
    setName(profile.name);
    setTaxId(profile.tax_id);
    setType(profile.type);
    setTaxSystem(profile.tax_system);
    setGroup(profile.group || 3);
    setRate(profile.rate || 5);
    setHasEmployees(!!profile.has_employees);
    setIsVatPayer(!!profile.is_vat_payer);
    setIsDirector(!!profile.is_director);
    setAddress(profile.address || '');
    setCalculationStartDate(profile.calculation_start_date || '');
    setStartingDebtEdp(profile.starting_debt_edp !== undefined && profile.starting_debt_edp !== null ? String(profile.starting_debt_edp) : '');
    setStartingDebtEsv(profile.starting_debt_esv !== undefined && profile.starting_debt_esv !== null ? String(profile.starting_debt_esv) : '');
    setStartingDebtVz(profile.starting_debt_vz !== undefined && profile.starting_debt_vz !== null ? String(profile.starting_debt_vz) : '');
    setStartingDebtPdfo(profile.starting_debt_pdfo !== undefined && profile.starting_debt_pdfo !== null ? String(profile.starting_debt_pdfo) : '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !taxId.trim()) {
      Alert.alert('Помилка', 'Заповніть назву компанії та ЄДРПОУ/ІПН');
      return;
    }

    if (!telegramId) return;

    try {
      const payload = {
        telegram_id: telegramId,
        type,
        name: name.trim(),
        tax_id: taxId.trim(),
        tax_system: taxSystem,
        is_director: type === 'company' ? isDirector : undefined,
        group: type === 'fop' ? group : undefined,
        rate,
        has_employees: hasEmployees,
        is_vat_payer: isVatPayer,
        reg_date: new Date().toISOString().split('T')[0],
        address: address.trim() || undefined,
        calculation_start_date: calculationStartDate || undefined,
        starting_debt_edp: startingDebtEdp ? parseFloat(startingDebtEdp) : 0,
        starting_debt_esv: startingDebtEsv ? parseFloat(startingDebtEsv) : 0,
        starting_debt_vz: startingDebtVz ? parseFloat(startingDebtVz) : 0,
        starting_debt_pdfo: startingDebtPdfo ? parseFloat(startingDebtPdfo) : 0,
      };

      if (editingProfile) {
        await api.updateProfile(editingProfile.id, payload);
        Alert.alert('Успіх', 'Профіль успішно оновлено');
      } else {
        await api.createProfile(payload);
        Alert.alert('Успіх', 'Профіль успішно створено');
      }
      setModalVisible(false);
      fetchProfiles();
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося зберегти профіль');
    }
  };

  const handleDelete = (id: number, profileName: string) => {
    Alert.alert(
      'Видалення профілю',
      `Ви впевнені, що хочете видалити профіль "${profileName}"? Усі транзакції та звіти цього профілю буде видалено безповоротно.`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteProfile(id);
              Alert.alert('Успіх', 'Профіль видалено');
              fetchProfiles();
            } catch (e) {
              console.error(e);
              Alert.alert('Помилка', 'Не вдалося видалити профіль');
            }
          },
        },
      ]
    );
  };

  const fetchEmployees = async (profileId: number) => {
    setEmployeesLoading(true);
    try {
      const data = await api.getEmployees(profileId);
      setEmployees(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити список працівників');
    } finally {
      setEmployeesLoading(false);
    }
  };

  const handleOpenEmployees = (profile: ProfileData) => {
    setSelectedProfile(profile);
    setEmployeesModalVisible(true);
    setEmployeeFormVisible(false);
    setEditingEmployee(null);
    setEmpName('');
    setEmpTaxId('');
    setEmpSalary('');
    fetchEmployees(profile.id);
  };

  const handleStartAddEmployee = () => {
    setEditingEmployee(null);
    setEmpName('');
    setEmpTaxId('');
    setEmpSalary('');
    setEmployeeFormVisible(true);
  };

  const handleStartEditEmployee = (emp: any) => {
    setEditingEmployee(emp);
    setEmpName(emp.name);
    setEmpTaxId(emp.tax_id || '');
    setEmpSalary(emp.salary.toString());
    setEmployeeFormVisible(true);
  };

  const handleSaveEmployee = async () => {
    if (!empName.trim() || !empTaxId.trim() || !empSalary.trim()) {
      Alert.alert('Помилка', 'Будь ласка, заповніть всі поля працівника');
      return;
    }

    const cleanedTaxId = empTaxId.trim();
    if (cleanedTaxId.length !== 10 || !/^\d+$/.test(cleanedTaxId)) {
      Alert.alert('Помилка', 'ІПН (РНОКПП) працівника має складатися рівно з 10 цифр');
      return;
    }

    const salaryNum = parseFloat(empSalary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
      Alert.alert('Помилка', 'Будь ласка, введіть ввічливу та коректну суму зарплати');
      return;
    }

    if (!selectedProfile) return;

    // Local check for duplicate tax ID in this profile
    const duplicate = employees.find(
      (emp) => emp.tax_id === cleanedTaxId && (!editingEmployee || emp.id !== editingEmployee.id)
    );
    if (duplicate) {
      Alert.alert('Помилка валідації', `Працівник з ІПН ${cleanedTaxId} вже зареєстрований у цьому профілі (${duplicate.name})`);
      return;
    }

    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, {
          name: empName.trim(),
          tax_id: cleanedTaxId,
          salary: salaryNum,
        });
        Alert.alert('Успіх', 'Дані працівника успішно оновлено');
      } else {
        await api.createEmployee({
          profile_id: selectedProfile.id,
          name: empName.trim(),
          tax_id: cleanedTaxId,
          salary: salaryNum,
        });
        Alert.alert('Успіх', 'Працівника успішно додано');
      }
      setEmployeeFormVisible(false);
      setEditingEmployee(null);
      setEmpName('');
      setEmpTaxId('');
      setEmpSalary('');
      fetchEmployees(selectedProfile.id);
    } catch (e: any) {
      console.error(e);
      const errMsg = e.response?.data?.detail || 'Не вдалося зберегти працівника';
      Alert.alert('Помилка', errMsg);
    }
  };

  const handleDeleteEmployee = (emp: any) => {
    if (!selectedProfile) return;
    Alert.alert(
      'Видалення працівника',
      `Ви впевнені, що хочете видалити працівника "${emp.name}"?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteEmployee(emp.id);
              Alert.alert('Успіх', 'Працівника видалено');
              fetchEmployees(selectedProfile.id);
            } catch (e) {
              console.error(e);
              Alert.alert('Помилка', 'Не вдалося видалити працівника');
            }
          },
        },
      ]
    );
  };

  const fetchInvoicesData = async (profileId: number) => {
    setInvoicesLoading(true);
    try {
      const [schedules, history] = await Promise.all([
        api.getRecurringInvoices(profileId),
        api.getInvoicesHistory(profileId),
      ]);
      setRecurringInvoices(schedules);
      setInvoicesHistory(history);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося завантажити дані рахунків');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleDownloadInvoicePdf = async (invoiceId: number) => {
    try {
      const url = api.getInvoicePdfUrl(invoiceId);
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалося відкрити рахунок');
    }
  };

  const handleDownloadDocumentPdf = async (invoiceId: number) => {
    try {
      const url = api.getInvoiceDocumentPdfUrl(invoiceId);
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалося відкрити супутній документ');
    }
  };

  const handleCreateInvoiceDocument = async (invoiceId: number, docType: string) => {
    try {
      setInvoicesLoading(true);
      await api.createInvoiceDocument(invoiceId, docType);
      if (selectedProfile) {
        await fetchInvoicesData(selectedProfile.id);
      }
      Alert.alert('Успіх', docType === 'waybill' ? 'Накладну успішно створено' : 'Акт успішно створено');
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося створити документ');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleOpenInvoices = (profile: ProfileData) => {
    setSelectedProfile(profile);
    setInvoicesModalVisible(true);
    setInvoiceFormVisible(false);
    setInvClientEmail('');
    setInvClientTg('');
    setInvAmount('');
    setInvServiceName('');
    setInvSendDay('1');
    setInvIncludeAct(true);
    setInvPeriodicity('monthly');
    setInvSendMonth(null);
    setInvClientName('');
    setInvClientTaxId('');
    setInvDocumentType('act');
    setInvActiveTab('schedules');
    
    // Clear one-off inputs
    setOneoffClientEmail('');
    setOneoffClientTg('');
    setOneoffAmount('');
    setOneoffServiceName('');
    setOneoffIncludeAct(true);
    setOneoffClientName('');
    setOneoffClientTaxId('');
    setOneoffDocumentType('act');
    
    fetchInvoicesData(profile.id);
  };

  const handleSaveRecurringInvoice = async () => {
    if (!invClientEmail.trim() || !invAmount.trim() || !invServiceName.trim() || !invSendDay.trim()) {
      Alert.alert('Помилка', 'Будь ласка, заповніть всі обов\'язкові поля');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(invClientEmail.trim())) {
      Alert.alert('Помилка', 'Введіть коректну адресу електронної пошти');
      return;
    }

    const amountNum = parseFloat(invAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Помилка', 'Введіть коректну суму рахунку');
      return;
    }

    const sendDayNum = parseInt(invSendDay, 10);
    if (isNaN(sendDayNum) || sendDayNum < 1 || sendDayNum > 28) {
      Alert.alert('Помилка', 'День відправки має бути числом від 1 до 28');
      return;
    }

    if (!selectedProfile) return;

    try {
      await api.createRecurringInvoice({
        profile_id: selectedProfile.id,
        client_email: invClientEmail.trim(),
        client_telegram_id: invClientTg.trim() || undefined,
        amount: amountNum,
        service_name: invServiceName.trim(),
        send_day: sendDayNum,
        include_act: invIncludeAct,
        send_month: invSendMonth,
        client_name: invClientName.trim() || undefined,
        client_tax_id: invClientTaxId.trim() || undefined,
        document_type: invDocumentType,
        client_address: invClientAddress.trim() || undefined,
      });
      Alert.alert('Успіх', 'Шаблон регулярного рахунку створено');
      setInvoiceFormVisible(false);
      setInvClientEmail('');
      setInvClientTg('');
      setInvAmount('');
      setInvServiceName('');
      setInvIncludeAct(true);
      setInvSendDay('1');
      setInvPeriodicity('monthly');
      setInvSendMonth(null);
      setInvClientName('');
      setInvClientTaxId('');
      setInvDocumentType('act');
      fetchInvoicesData(selectedProfile.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося зберегти шаблон');
    }
  };

  const handleSendOneoffInvoice = async () => {
    if (!oneoffClientEmail.trim() || !oneoffAmount.trim() || !oneoffServiceName.trim()) {
      Alert.alert('Помилка', 'Будь ласка, заповніть всі обов\'язкові поля');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(oneoffClientEmail.trim())) {
      Alert.alert('Помилка', 'Введіть коректну адресу електронної пошти');
      return;
    }

    const amountNum = parseFloat(oneoffAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Помилка', 'Введіть коректну суму рахунку');
      return;
    }

    if (!selectedProfile) return;

    try {
      setInvoicesLoading(true);
      await api.sendOneoffInvoice({
        profile_id: selectedProfile.id,
        client_email: oneoffClientEmail.trim(),
        client_telegram_id: oneoffClientTg.trim() || undefined,
        amount: amountNum,
        service_name: oneoffServiceName.trim(),
        include_act: oneoffIncludeAct,
        client_name: oneoffClientName.trim() || undefined,
        client_tax_id: oneoffClientTaxId.trim() || undefined,
        document_type: oneoffDocumentType,
        client_address: oneoffClientAddress.trim() || undefined,
      });
      haptics.success();
      Alert.alert('Успіх', 'Рахунок успішно надіслано клієнту!');
      
      // Clear inputs
      setOneoffClientEmail('');
      setOneoffClientTg('');
      setOneoffAmount('');
      setOneoffServiceName('');
      setOneoffIncludeAct(true);
      setOneoffClientName('');
      setOneoffClientTaxId('');
      setOneoffDocumentType('act');
      setOneoffClientAddress('');
      
      // Switch to history tab
      setInvActiveTab('history');
      fetchInvoicesData(selectedProfile.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося надіслати рахунок');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleDeleteRecurringInvoice = (id: number) => {
    if (!selectedProfile) return;
    Alert.alert(
      'Видалення шаблону',
      'Ви впевнені, що хочете видалити цей регулярний рахунок?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteRecurringInvoice(id);
              Alert.alert('Успіх', 'Шаблон видалено');
              fetchInvoicesData(selectedProfile.id);
            } catch (e) {
              console.error(e);
              Alert.alert('Помилка', 'Не вдалося видалити шаблон');
            }
          },
        },
      ]
    );
  };

  const handleOpenSendConfirm = (id: number, defaultIncludeAct?: boolean) => {
    setTargetInvoiceId(id);
    const today = new Date();
    setCustomSendDay(today.getDate().toString());
    setCustomSendMonth((today.getMonth() + 1).toString());
    setCustomDateEnabled(false);
    
    const rec = recurringInvoices.find(item => item.id === id);
    setSendIncludeAct(defaultIncludeAct !== undefined ? defaultIncludeAct : (rec ? rec.include_act : true));
    
    setSendConfirmModalVisible(true);
  };

  const handleConfirmSendInvoice = async () => {
    if (!targetInvoiceId || !selectedProfile) return;

    let dayParam: number | undefined = undefined;
    let monthParam: number | undefined = undefined;

    if (customDateEnabled) {
      const parsedDay = parseInt(customSendDay, 10);
      const parsedMonth = parseInt(customSendMonth, 10);

      if (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31) {
        Alert.alert('Помилка', 'День має бути числом від 1 до 31');
        return;
      }
      if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        Alert.alert('Помилка', 'Місяць має бути числом від 1 до 12');
        return;
      }
      dayParam = parsedDay;
      monthParam = parsedMonth;
    }

    setSendConfirmModalVisible(false);
    setInvoicesLoading(true);
    try {
      await api.sendInvoiceNow(targetInvoiceId, dayParam, monthParam, sendIncludeAct);
      Alert.alert('Успіх', 'Рахунок та Акт успішно згенеровані та надіслані!');
      fetchInvoicesData(selectedProfile.id);
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Не вдалося надіслати рахунок');
    } finally {
      setInvoicesLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : profiles.length === 0 ? (
        <View style={styles.center}>
          <Briefcase size={64} color={colors.textMuted} style={styles.emptyIcon} />
          <Text style={[styles.emptyText, { color: colors.text }]}>Не знайдено створених профілів</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Створіть свій перший профіль ФОП або юридичної особи для нарахування податків.
          </Text>
          <Button title="Додати профіль" onPress={handleOpenAdd} style={styles.emptyBtn} />
        </View>
      ) : (
        <>
          <FlatList
            data={profiles}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Card style={styles.profileCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.headerTitleContainer}>
                    <Briefcase size={20} color={colors.primary} style={styles.briefcase} />
                    <Text style={[styles.profileName, { color: colors.text }]}>{item.name}</Text>
                  </View>
                  <View style={styles.actions}>
                    <Pressable onPress={() => handleOpenInvoices(item)} style={styles.actionBtn}>
                      <FileText size={18} color="#eab308" />
                    </Pressable>
                    {item.has_employees && (
                      <Pressable onPress={() => handleOpenEmployees(item)} style={styles.actionBtn}>
                        <Users size={18} color={colors.success} />
                      </Pressable>
                    )}
                    <Pressable onPress={() => handleOpenSupportChat(item)} style={styles.actionBtn}>
                      <Mail size={18} color="#3b82f6" />
                    </Pressable>
                    <Pressable onPress={() => handleOpenEdit(item)} style={styles.actionBtn}>
                      <Edit3 size={18} color={colors.primary} />
                    </Pressable>
                    <Pressable onPress={() => handleDelete(item.id, item.name)} style={styles.actionBtn}>
                      <Trash2 size={18} color={colors.error} />
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.infoGrid}>
                  <View style={styles.infoCol}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>ЄДРПОУ / ІПН</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>{item.tax_id}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Тип</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {item.type === 'fop' ? 'ФОП' : 'Юр. особа'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoCol}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Система</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {item.tax_system === 'single_tax' ? 'Єдиний податок' : 'Загальна'}
                    </Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Ставка / Група</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {item.rate}% {item.type === 'fop' && `(${item.group} група)`}
                    </Text>
                  </View>
                </View>

                {item.address && (
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Юридична адреса</Text>
                    <Text style={[styles.infoValue, { color: colors.text, fontSize: 12 }]} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>
                )}

                <View style={styles.tagsContainer}>
                  {item.has_employees ? (
                    <Pressable
                      style={[
                        styles.tag,
                        { backgroundColor: colors.successMuted },
                      ]}
                      onPress={() => handleOpenEmployees(item)}
                    >
                      <Users size={12} color={colors.success} />
                      <Text
                        style={[
                          styles.tagText,
                          { color: colors.success },
                        ]}
                      >
                        Є наймані працівники (Налаштувати)
                      </Text>
                    </Pressable>
                  ) : (
                    <View
                      style={[
                        styles.tag,
                        { backgroundColor: colors.border },
                      ]}
                    >
                      <Users size={12} color={colors.textMuted} />
                      <Text
                        style={[
                          styles.tagText,
                          { color: colors.textMuted },
                        ]}
                      >
                        Без працівників
                      </Text>
                    </View>
                  )}

                  <Pressable
                    style={[
                      styles.tag,
                      { backgroundColor: colors.warningMuted, borderColor: colors.warning, borderWidth: 1 },
                    ]}
                    onPress={() => handleOpenInvoices(item)}
                  >
                    <FileText size={12} color={colors.warning} />
                    <Text
                      style={[
                        styles.tagText,
                        { color: colors.warning },
                      ]}
                    >
                      Рахунки та Акти (Авто-відправка)
                    </Text>
                  </Pressable>
                </View>
              </Card>
            )}
          />
        </>
      )}

      {/* Support Chat Modal */}
      {supportModalVisible && supportChatProfile && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={supportModalVisible}
          onRequestClose={() => setSupportModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSupportModalVisible(false)} />
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
                    height: windowHeight * 0.7,
                    maxHeight: windowHeight * 0.7,
                    width: '100%',
                    paddingBottom: Math.max(insets.bottom, 12),
                  },
                ]}
              >
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={[styles.modalTitle, { color: colors.text, fontSize: 16 }]}>Служба підтримки</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                      Профіль: {supportChatProfile.name}
                    </Text>
                  </View>
                  <Pressable onPress={() => setSupportModalVisible(false)} style={styles.closeBtn}>
                    <X size={24} color={colors.text} />
                  </Pressable>
                </View>

                {/* Messages List */}
                <FlatList
                  data={supportMessages}
                  keyExtractor={(item) => item.id.toString()}
                  style={{ flex: 1, paddingVertical: 12 }}
                  contentContainerStyle={{ paddingBottom: 24 }}
                  renderItem={({ item }) => {
                    const isFromAdmin = item.is_from_admin;
                    return (
                      <View style={{
                        flexDirection: 'row',
                        justifyContent: isFromAdmin ? 'flex-start' : 'flex-end',
                        marginBottom: 10,
                        paddingHorizontal: 8
                      }}>
                        <View style={{
                          backgroundColor: isFromAdmin ? colors.border : colors.primary,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 16,
                          borderBottomLeftRadius: isFromAdmin ? 2 : 16,
                          borderBottomRightRadius: isFromAdmin ? 16 : 2,
                          maxWidth: '80%',
                        }}>
                          <Text style={{
                            color: isFromAdmin ? colors.text : '#ffffff',
                            fontSize: 13,
                            lineHeight: 18
                          }}>
                            {item.text}
                          </Text>
                          <Text style={{
                            color: isFromAdmin ? colors.textMuted : 'rgba(255,255,255,0.7)',
                            fontSize: 9,
                            textAlign: 'right',
                            marginTop: 4
                          }}>
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </View>
                    );
                  }}
                  ListEmptyComponent={() => (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                      <Mail size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
                      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: 40 }}>
                        Немає повідомлень. Напишіть нам ваше питання, і адміністратор відповість вам найближчим часом.
                      </Text>
                    </View>
                  )}
                />

                {/* Send input */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: 8,
                  paddingHorizontal: 8,
                }}>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        flex: 1,
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        marginBottom: 0,
                        marginRight: 8,
                        borderRadius: 20,
                        paddingHorizontal: 16,
                        height: 40,
                      }
                    ]}
                    value={supportInputText}
                    onChangeText={setSupportInputText}
                    placeholder="Напишіть повідомлення..."
                    placeholderTextColor={colors.textMuted + '80'}
                  />
                  <TouchableOpacity
                    onPress={handleSendSupportMessage}
                    disabled={!supportInputText.trim() || sendingSupport}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: supportInputText.trim() ? colors.primary : colors.border,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Send size={18} color={supportInputText.trim() ? '#ffffff' : colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      {/* Add / Edit Profile Modal */}
      {modalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setModalVisible(false)} />
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
                  paddingBottom: Math.max(insets.bottom, 16),
                  width: '100%',
                  flexGrow: 0,
                  flexShrink: 1,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingProfile ? 'Редагувати профіль' : 'Новий профіль'}
                </Text>
                <Pressable onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                  <X size={24} color={colors.text} />
                </Pressable>
              </View>

                <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
                  <Input
                    label="Назва підприємства / ПІБ ФОП"
                    placeholder="Наприклад: ФОП Петренко Іван"
                    value={name}
                    onChangeText={setName}
                  />

                  <Input
                    label="ЄДРПОУ / ІПН (Код)"
                    placeholder="8 або 10 цифр"
                    value={taxId}
                    onChangeText={setTaxId}
                    keyboardType="number-pad"
                    maxLength={10}
                  />

                  <Input
                    label="Юридична адреса"
                    placeholder="Наприклад: вул. Хрещатик, 1, м. Київ"
                    value={address}
                    onChangeText={setAddress}
                  />

                  {/* Segmented Control for Profile Type */}
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Тип суб'єкта</Text>
                  <View style={styles.segmentedContainer}>
                    <Pressable
                      style={[
                        styles.segment,
                        type === 'fop' && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => setType('fop')}
                    >
                      <Text style={[styles.segmentText, type === 'fop' && { color: '#ffffff' }, { color: colors.text }]}>
                        ФОП
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.segment,
                        type === 'company' && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => setType('company')}
                    >
                      <Text style={[styles.segmentText, type === 'company' && { color: '#ffffff' }, { color: colors.text }]}>
                        Юридична особа
                      </Text>
                    </Pressable>
                  </View>

                  {/* Specific fields for Company */}
                  {type === 'company' && (
                    <View style={styles.switchRow}>
                      <Text style={[styles.switchLabel, { color: colors.text }]}>Я директор (підписант)</Text>
                      <Switch
                        value={isDirector}
                        onValueChange={setIsDirector}
                        trackColor={{ false: '#767577', true: colors.primary }}
                        thumbColor={isDirector ? '#ffffff' : '#f4f3f4'}
                      />
                    </View>
                  )}

                  {/* Segmented Control for Tax System */}
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Система оподаткування</Text>
                  <View style={styles.segmentedContainer}>
                    <Pressable
                      style={[
                        styles.segment,
                        taxSystem === 'single_tax' && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => setTaxSystem('single_tax')}
                    >
                      <Text style={[styles.segmentText, taxSystem === 'single_tax' && { color: '#ffffff' }, { color: colors.text }]}>
                        Єдиний податок
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.segment,
                        taxSystem === 'general_tax' && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => setTaxSystem('general_tax')}
                    >
                      <Text style={[styles.segmentText, taxSystem === 'general_tax' && { color: '#ffffff' }, { color: colors.text }]}>
                        Загальна система
                      </Text>
                    </Pressable>
                  </View>

                  {/* Specific fields for Single Tax FOP */}
                  {type === 'fop' && taxSystem === 'single_tax' && (
                    <>
                      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Група єдиного податку</Text>
                      <View style={styles.segmentedContainer}>
                        {[1, 2, 3].map((g) => (
                          <Pressable
                            key={g}
                            style={[
                              styles.segment,
                              group === g && { backgroundColor: colors.primary },
                            ]}
                            onPress={() => {
                              setGroup(g);
                              // Default rates for groups
                              if (g === 1 || g === 2) setRate(0); // Fixed tax rates set at calendar level
                              if (g === 3) setRate(5);
                            }}
                          >
                            <Text style={[styles.segmentText, group === g && { color: '#ffffff' }, { color: colors.text }]}>
                              Група {g}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Tax Rate (for Group 3 or General System) */}
                  {(taxSystem === 'general_tax' || (type === 'fop' && group === 3)) && (
                    <Input
                      label="Податкова ставка (%)"
                      placeholder="Зазвичай 5"
                      value={rate.toString()}
                      onChangeText={(val) => setRate(parseFloat(val) || 0)}
                      keyboardType="decimal-pad"
                    />
                  )}

                  {/* Employees and VAT Switches */}
                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: colors.text }]}>Є наймані працівники</Text>
                    <Switch
                      value={hasEmployees}
                      onValueChange={setHasEmployees}
                      trackColor={{ false: '#767577', true: colors.primary }}
                      thumbColor={hasEmployees ? '#ffffff' : '#f4f3f4'}
                    />
                  </View>

                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: colors.text }]}>Платник ПДВ</Text>
                    <Switch
                      value={isVatPayer}
                      onValueChange={setIsVatPayer}
                      trackColor={{ false: '#767577', true: colors.primary }}
                      thumbColor={isVatPayer ? '#ffffff' : '#f4f3f4'}
                    />
                  </View>

                  <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 16, marginBottom: 8 }]}>
                    Фіксація початкових боргів
                  </Text>
                  
                  <Input
                    label="Дата фіксації боргів (РРРР-ММ-ДД)"
                    placeholder="Наприклад: 2026-01-01"
                    value={calculationStartDate}
                    onChangeText={setCalculationStartDate}
                  />
                  
                  <Input
                    label="Початковий борг по Єдиному податку (грн)"
                    placeholder="0"
                    value={startingDebtEdp}
                    onChangeText={setStartingDebtEdp}
                    keyboardType="numeric"
                  />
                  
                  <Input
                    label="Початковий борг по ЄСВ (грн)"
                    placeholder="0"
                    value={startingDebtEsv}
                    onChangeText={setStartingDebtEsv}
                    keyboardType="numeric"
                  />
                  
                  <Input
                    label="Початковий борг по Військовому збору (грн)"
                    placeholder="0"
                    value={startingDebtVz}
                    onChangeText={setStartingDebtVz}
                    keyboardType="numeric"
                  />
                  
                  <Input
                    label="Початковий борг по ПДФО (грн)"
                    placeholder="0"
                    value={startingDebtPdfo}
                    onChangeText={setStartingDebtPdfo}
                    keyboardType="numeric"
                  />

                  <Button
                    title={editingProfile ? 'Оновити профіль' : 'Створити профіль'}
                    onPress={handleSave}
                    style={styles.saveBtn}
                  />
                </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      )}

      {/* Employees Management Modal */}
      {employeesModalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={employeesModalVisible}
          onRequestClose={() => setEmployeesModalVisible(false)}
        >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setEmployeesModalVisible(false)} />
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
                  paddingBottom: Math.max(insets.bottom, 16),
                  width: '100%',
                  flexGrow: 0,
                  flexShrink: 1,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    Працівники {selectedProfile?.name}
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                    Управління штатом та зарплатами
                  </Text>
                </View>
                <Pressable onPress={() => setEmployeesModalVisible(false)} style={styles.closeBtn}>
                  <X size={24} color={colors.text} />
                </Pressable>
              </View>

                {employeeFormVisible ? (
                  // Add/Edit Employee Form
                  <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={styles.employeeForm} keyboardShouldPersistTaps="handled">
                    <Text style={[styles.formSectionTitle, { color: colors.text }]}>
                      {editingEmployee ? 'Редагувати дані працівника' : 'Додати нового працівника'}
                    </Text>

                    <Input
                      label="ПІБ працівника"
                      placeholder="Наприклад: Коваленко Андрій Петрович"
                      value={empName}
                      onChangeText={setEmpName}
                    />

                    <Input
                      label="ІПН (РНОКПП) - 10 цифр"
                      placeholder="Наприклад: 3123456789"
                      value={empTaxId}
                      onChangeText={setEmpTaxId}
                      keyboardType="number-pad"
                      maxLength={10}
                    />

                    <Input
                      label="Місячний оклад (грн)"
                      placeholder="Наприклад: 25000"
                      value={empSalary}
                      onChangeText={setEmpSalary}
                      keyboardType="decimal-pad"
                    />

                    <View style={styles.formActions}>
                      <Button
                        title="Скасувати"
                        onPress={() => setEmployeeFormVisible(false)}
                        variant="outline"
                        style={styles.halfBtn}
                      />
                      <Button
                        title={editingEmployee ? 'Зберегти' : 'Додати'}
                        onPress={handleSaveEmployee}
                        style={styles.halfBtn}
                      />
                    </View>
                  </ScrollView>
                ) : (
                  // Employees List
                  <View style={{ flexShrink: 1, minHeight: 150, maxHeight: 400 }}>
                    <View style={styles.listHeader}>
                      <Text style={[styles.listCount, { color: colors.textMuted }]}>
                        Всього працівників: {employees.length}
                      </Text>
                      <Button
                        title="Додати працівника"
                        onPress={handleStartAddEmployee}
                        style={styles.addEmpBtn}
                        textStyle={{ fontSize: 13 }}
                      />
                    </View>

                    {employeesLoading ? (
                      <View style={styles.modalCenter}>
                        <ActivityIndicator size="large" color={colors.primary} />
                      </View>
                    ) : employees.length === 0 ? (
                      <View style={styles.modalCenter}>
                        <Users size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
                        <Text style={[styles.emptyTextSmall, { color: colors.text }]}>
                          Немає зареєстрованих працівників
                        </Text>
                        <Text style={[styles.emptySubSmall, { color: colors.textMuted }]}>
                          Додайте першого працівника, щоб нараховувати зарплатні податки та звіти.
                        </Text>
                      </View>
                    ) : (
                      <FlatList
                        style={{ flexGrow: 0, flexShrink: 1 }}
                        data={employees}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={[styles.empList, { paddingBottom: 100 }]}
                        renderItem={({ item }) => (
                          <View style={[styles.empCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                            <View style={styles.empInfo}>
                              <Text style={[styles.empNameText, { color: colors.text }]}>{item.name}</Text>
                              <Text style={[styles.empDetailsText, { color: colors.textMuted }]}>
                                ІПН: {item.tax_id}
                              </Text>
                              <View style={styles.salaryBadgeContainer}>
                                <Coins size={14} color={colors.success} style={{ marginRight: 4 }} />
                                <Text style={[styles.empSalaryText, { color: colors.success }]}>
                                  {item.salary.toLocaleString('uk-UA')} ₴ / міс
                                </Text>
                              </View>
                            </View>
                            <View style={styles.empActions}>
                              <Pressable onPress={() => handleStartEditEmployee(item)} style={styles.empActionBtn}>
                                <Edit3 size={16} color={colors.primary} />
                              </Pressable>
                              <Pressable onPress={() => handleDeleteEmployee(item)} style={styles.empActionBtn}>
                                <Trash2 size={16} color={colors.error} />
                              </Pressable>
                            </View>
                          </View>
                        )}
                      />
                    )}
                  </View>
                )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      )}

      {/* Invoices & Acts Management Modal */}
      {invoicesModalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={invoicesModalVisible}
          onRequestClose={() => setInvoicesModalVisible(false)}
        >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setInvoicesModalVisible(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', justifyContent: 'flex-end' }}
            pointerEvents="box-none"
          >
            <View
              style={[
                styles.modalContent,
                {
                  width: '100%',
                  backgroundColor: colors.background,
                  borderColor: colors.cardBorder,
                  maxHeight: modalMaxHeight,
                  paddingBottom: Math.max(insets.bottom, 16),
                  flexGrow: 0,
                  flexShrink: 1,
                },
              ]}
            >
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
                      Рахунки та Акти: {selectedProfile?.name}
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                      Автоматизація регулярного виставлення рахунків
                    </Text>
                  </View>
                  <Pressable onPress={() => setInvoicesModalVisible(false)} style={styles.closeBtn}>
                    <X size={24} color={colors.text} />
                  </Pressable>
                </View>

                {/* Segmented Control / Tabs */}
                <View style={styles.segmentedContainer}>
                  <Pressable
                    style={[
                      styles.segment,
                      invActiveTab === 'schedules' && { backgroundColor: colors.cardBorder || 'rgba(120, 120, 128, 0.2)' },
                    ]}
                    onPress={() => {
                      setInvActiveTab('schedules');
                      setInvoiceFormVisible(false);
                    }}
                  >
                    <Text style={[styles.segmentText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                      Авто-надсилання
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.segment,
                      invActiveTab === 'oneoff' && { backgroundColor: colors.cardBorder || 'rgba(120, 120, 128, 0.2)' },
                    ]}
                    onPress={() => {
                      setInvActiveTab('oneoff');
                      setInvoiceFormVisible(false);
                    }}
                  >
                    <Text style={[styles.segmentText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                      Разовий рахунок
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.segment,
                      invActiveTab === 'history' && { backgroundColor: colors.cardBorder || 'rgba(120, 120, 128, 0.2)' },
                    ]}
                    onPress={() => {
                      setInvActiveTab('history');
                      setInvoiceFormVisible(false);
                    }}
                  >
                    <Text style={[styles.segmentText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                      Історія
                    </Text>
                  </Pressable>
                </View>

                {invActiveTab === 'schedules' && (
                  invoiceFormVisible ? (
                    // Add Recurring Invoice Form
                    <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
                      <Text style={[styles.formSectionTitle, { color: colors.text, marginTop: 8 }]}>
                        Новий шаблон авто-надсилання
                      </Text>

                      <Input
                        label="Назва або ПІБ клієнта"
                        placeholder="Наприклад: ТОВ 'Вектор' або Фізична особа"
                        value={invClientName}
                        onChangeText={setInvClientName}
                      />

                      <Input
                        label="ЄДРПОУ / ІПН клієнта"
                        placeholder="Наприклад: 12345678"
                        value={invClientTaxId}
                        onChangeText={(val) => setInvClientTaxId(val.replace(/\D/g, ''))}
                        keyboardType="number-pad"
                      />

                      <Input
                        label="Адреса клієнта"
                        placeholder="Наприклад: вул. Шевченка, 10, м. Львів"
                        value={invClientAddress}
                        onChangeText={setInvClientAddress}
                      />

                      <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600', marginTop: 12, marginBottom: 6 }}>
                        Тип операції
                      </Text>
                      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                        <Pressable
                          style={[
                            styles.periodicityBtn,
                            invDocumentType === 'act' && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
                          ]}
                          onPress={() => setInvDocumentType('act')}
                        >
                          <Text style={[styles.periodicityText, invDocumentType === 'act' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                            Послуга (Акт)
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.periodicityBtn,
                            invDocumentType === 'waybill' && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                            { marginLeft: 8 }
                          ]}
                          onPress={() => setInvDocumentType('waybill')}
                        >
                          <Text style={[styles.periodicityText, invDocumentType === 'waybill' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                            Товар (Накладна)
                          </Text>
                        </Pressable>
                      </View>

                      <Input
                        label="Email клієнта (для рахунку/акту) *"
                        placeholder="client@company.com"
                        value={invClientEmail}
                        onChangeText={setInvClientEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />

                      <Input
                        label="Telegram ID клієнта (опціонально, для сповіщень)"
                        placeholder="Наприклад: 58291038"
                        value={invClientTg}
                        onChangeText={setInvClientTg}
                        keyboardType="number-pad"
                      />

                      <Input
                        label="Сума рахунку (грн) *"
                        placeholder="Наприклад: 15000"
                        value={invAmount}
                        onChangeText={setInvAmount}
                        keyboardType="decimal-pad"
                      />

                      <Input
                        label="Опис послуги / Назва товару *"
                        placeholder="Наприклад: Надання інформаційно-консультаційних послуг"
                        value={invServiceName}
                        onChangeText={setInvServiceName}
                      />

                      <View style={[styles.switchRow, { marginVertical: 8 }]}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={[styles.switchTitle, { color: colors.text, fontSize: 14 }]}>
                            {invDocumentType === 'act' ? 'Генерувати акт виконаних робіт' : 'Генерувати видаткову накладну'}
                          </Text>
                          <Text style={[styles.switchDesc, { color: colors.textMuted, fontSize: 11 }]}>
                            {invDocumentType === 'act'
                              ? 'Автоматично створювати та надсилати акт разом із рахунком'
                              : 'Автоматично створювати та надсилати видаткову накладну разом із рахунком'}
                          </Text>
                        </View>
                        <Switch
                          value={invIncludeAct}
                          onValueChange={setInvIncludeAct}
                          trackColor={{ false: '#767577', true: colors.primary }}
                          thumbColor={invIncludeAct ? '#ffffff' : '#f4f3f4'}
                        />
                      </View>

                      <Text style={[styles.sectionLabel, { color: colors.textMuted, fontSize: 12, marginTop: 12, marginBottom: 6 }]}>
                        Періодичність
                      </Text>
                      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                        <Pressable
                          style={[
                            styles.periodicityBtn,
                            invPeriodicity === 'monthly' && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
                          ]}
                          onPress={() => {
                            setInvPeriodicity('monthly');
                            setInvSendMonth(null);
                          }}
                        >
                          <Text style={[styles.periodicityText, invPeriodicity === 'monthly' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                            Щомісячно
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.periodicityBtn,
                            invPeriodicity === 'specific' && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                            { marginLeft: 8 }
                          ]}
                          onPress={() => {
                            setInvPeriodicity('specific');
                            setInvSendMonth(new Date().getMonth() + 1); // default to current month
                          }}
                        >
                          <Text style={[styles.periodicityText, invPeriodicity === 'specific' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                            Один раз на рік
                          </Text>
                        </Pressable>
                      </View>

                      {invPeriodicity === 'specific' && (
                        <Input
                          label="Місяць відправки (1-12) *"
                          placeholder="Наприклад: 12 (Грудень)"
                          value={invSendMonth ? invSendMonth.toString() : ''}
                          onChangeText={(val) => {
                            const parsed = parseInt(val, 10);
                            if (isNaN(parsed)) {
                              setInvSendMonth(null);
                            } else {
                              setInvSendMonth(Math.max(1, Math.min(12, parsed)));
                            }
                          }}
                          keyboardType="number-pad"
                          maxLength={2}
                        />
                      )}

                      <Input
                        label="Число відправки щомісяця (1-28) *"
                        placeholder="1"
                        value={invSendDay}
                        onChangeText={setInvSendDay}
                        keyboardType="number-pad"
                        maxLength={2}
                      />

                      <View style={styles.formActions}>
                        <Button
                          title="Скасувати"
                          onPress={() => setInvoiceFormVisible(false)}
                          variant="outline"
                          style={styles.halfBtn}
                        />
                        <Button
                          title="Створити"
                          onPress={handleSaveRecurringInvoice}
                          style={styles.halfBtn}
                        />
                      </View>
                    </ScrollView>
                  ) : (
                    // Schedules list
                    <View style={{ flexShrink: 1 }}>
                      <View style={styles.listHeader}>
                        <Text style={[styles.listCount, { color: colors.textMuted }]}>
                          Активних розкладів: {recurringInvoices.length}
                        </Text>
                        <Button
                          title="Створити шаблон"
                          onPress={() => setInvoiceFormVisible(true)}
                          style={styles.addEmpBtn}
                          textStyle={{ fontSize: 13 }}
                        />
                      </View>

                      {invoicesLoading ? (
                        <View style={styles.modalCenter}>
                          <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                      ) : recurringInvoices.length === 0 ? (
                        <View style={styles.modalCenter}>
                          <Calendar size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
                          <Text style={[styles.emptyTextSmall, { color: colors.text }]}>
                            Немає активних авто-надсилань
                          </Text>
                          <Text style={[styles.emptySubSmall, { color: colors.textMuted }]}>
                            Створіть шаблон, і система автоматично генеруватиме рахунки та акти виконаних робіт обраного числа кожного місяця.
                          </Text>
                        </View>
                      ) : (
                        <FlatList
                          style={{ flexGrow: 0, flexShrink: 1 }}
                          data={recurringInvoices}
                          keyExtractor={(item) => item.id.toString()}
                          contentContainerStyle={[styles.empList, { paddingBottom: 100 }]}
                          showsVerticalScrollIndicator={false}
                          renderItem={({ item }) => (
                            <View style={[styles.empCard, { flexDirection: 'column', alignItems: 'stretch', backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                              <View style={styles.empInfo}>
                                <Text style={[styles.empNameText, { color: colors.text }]} numberOfLines={1}>
                                  {item.service_name}
                                </Text>
                                <Text style={[styles.empDetailsText, { color: colors.textMuted }]}>
                                  Кому: {item.client_email}
                                  {item.client_telegram_id ? ` (Tg: ${item.client_telegram_id})` : ''}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                  <Coins size={14} color={colors.success} style={{ marginRight: 4 }} />
                                  <Text style={[styles.empSalaryText, { color: colors.success, marginRight: 12 }]}>
                                    {item.amount.toLocaleString('uk-UA')} ₴
                                  </Text>
                                  <Calendar size={14} color={colors.primary} style={{ marginRight: 4 }} />
                                  <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500' }}>
                                    {item.send_month ? `${item.send_month}-го місяця, ` : ''}{item.send_day}-го числа
                                  </Text>
                                </View>
                              </View>
                              
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderColor: colors.cardBorder || 'rgba(120,120,128,0.2)', paddingTop: 10 }}>
                                <Button
                                  title="Надіслати рахунок"
                                  onPress={() => handleOpenSendConfirm(item.id, false)}
                                  variant="outline"
                                  style={{ flex: 1, minHeight: 38, paddingVertical: 6 }}
                                  textStyle={{ fontSize: 11 }}
                                />
                                <Button
                                  title="Рахунок + Акт"
                                  onPress={() => handleOpenSendConfirm(item.id, true)}
                                  variant="primary"
                                  style={{ flex: 1.2, minHeight: 38, paddingVertical: 6, marginLeft: 8 }}
                                  textStyle={{ fontSize: 11 }}
                                />
                                <Pressable
                                  onPress={() => handleDeleteRecurringInvoice(item.id)}
                                  style={{ padding: 10, marginLeft: 6 }}
                                >
                                  <Trash2 size={18} color={colors.error} />
                                </Pressable>
                              </View>
                            </View>
                          )}
                        />
                      )}
                    </View>
                  )
                )}

                {invActiveTab === 'oneoff' && (
                  // One-off Invoice Form
                  <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.formSectionTitle, { color: colors.text, marginTop: 8 }]}>
                      Новий разовий рахунок
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: colors.textMuted, marginBottom: 12 }]}>
                      Рахунок буде надіслано негайно без збереження регулярного шаблону
                    </Text>

                    <Input
                      label="Назва або ПІБ клієнта"
                      placeholder="Наприклад: ТОВ 'Вектор' або Фізична особа"
                      value={oneoffClientName}
                      onChangeText={setOneoffClientName}
                    />

                    <Input
                      label="ЄДРПОУ / ІПН клієнта"
                      placeholder="Наприклад: 12345678"
                      value={oneoffClientTaxId}
                      onChangeText={(val) => setOneoffClientTaxId(val.replace(/\D/g, ''))}
                      keyboardType="number-pad"
                    />

                    <Input
                      label="Адреса клієнта"
                      placeholder="Наприклад: вул. Шевченка, 10, м. Львів"
                      value={oneoffClientAddress}
                      onChangeText={setOneoffClientAddress}
                    />

                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600', marginTop: 12, marginBottom: 6 }}>
                      Тип операції
                    </Text>
                    <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                      <Pressable
                        style={[
                          styles.periodicityBtn,
                          oneoffDocumentType === 'act' && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
                        ]}
                        onPress={() => setOneoffDocumentType('act')}
                      >
                        <Text style={[styles.periodicityText, oneoffDocumentType === 'act' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                          Послуга (Акт)
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.periodicityBtn,
                          oneoffDocumentType === 'waybill' && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                          { marginLeft: 8 }
                        ]}
                        onPress={() => setOneoffDocumentType('waybill')}
                      >
                        <Text style={[styles.periodicityText, oneoffDocumentType === 'waybill' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }]}>
                          Товар (Накладна)
                        </Text>
                      </Pressable>
                    </View>

                    <Input
                      label="Email клієнта (для рахунку/акту) *"
                      placeholder="client@company.com"
                      value={oneoffClientEmail}
                      onChangeText={setOneoffClientEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />

                    <Input
                      label="Telegram ID клієнта (опціонально, для сповіщень)"
                      placeholder="Наприклад: 58291038"
                      value={oneoffClientTg}
                      onChangeText={setOneoffClientTg}
                      keyboardType="number-pad"
                    />

                    <Input
                      label="Сума рахунку (грн) *"
                      placeholder="Наприклад: 15000"
                      value={oneoffAmount}
                      onChangeText={setOneoffAmount}
                      keyboardType="decimal-pad"
                    />

                    <Input
                      label="Опис послуги / Назва товару *"
                      placeholder="Наприклад: Надання інформаційно-консультаційних послуг"
                      value={oneoffServiceName}
                      onChangeText={setOneoffServiceName}
                    />

                    <View style={[styles.switchRow, { marginVertical: 8 }]}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.switchTitle, { color: colors.text, fontSize: 14 }]}>
                          {oneoffDocumentType === 'act' ? 'Генерувати акт виконаних робіт' : 'Генерувати видаткову накладну'}
                        </Text>
                        <Text style={[styles.switchDesc, { color: colors.textMuted, fontSize: 11 }]}>
                          {oneoffDocumentType === 'act'
                            ? 'Автоматично створити та надіслати акт разом із рахунком'
                            : 'Автоматично створити та надіслати видаткову накладну разом із рахунком'}
                        </Text>
                      </View>
                      <Switch
                        value={oneoffIncludeAct}
                        onValueChange={setOneoffIncludeAct}
                        trackColor={{ false: '#767577', true: colors.primary }}
                        thumbColor={oneoffIncludeAct ? '#ffffff' : '#f4f3f4'}
                      />
                    </View>

                    <View style={[styles.formActions, { marginTop: 16 }]}>
                      <Button
                        title="Скасувати"
                        onPress={() => setInvoicesModalVisible(false)}
                        variant="outline"
                        style={styles.halfBtn}
                      />
                      <Button
                        title="Надіслати зараз"
                        onPress={handleSendOneoffInvoice}
                        style={styles.halfBtn}
                      />
                    </View>
                  </ScrollView>
                )}

                {invActiveTab === 'history' && (
                  // Invoices & Acts history list
                  <View style={{ flexShrink: 1 }}>
                    <View style={styles.listHeader}>
                      <Text style={[styles.listCount, { color: colors.textMuted }]}>
                        Всього згенеровано документів: {invoicesHistory.length}
                      </Text>
                    </View>

                    {invoicesLoading ? (
                      <View style={styles.modalCenter}>
                        <ActivityIndicator size="large" color={colors.primary} />
                      </View>
                    ) : invoicesHistory.length === 0 ? (
                      <View style={styles.modalCenter}>
                        <FileText size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
                        <Text style={[styles.emptyTextSmall, { color: colors.text }]}>
                          Історія документів порожня
                        </Text>
                        <Text style={[styles.emptySubSmall, { color: colors.textMuted }]}>
                          Тут відображатимуться всі автоматично або вручну виставлені рахунки та акти виконаних послуг.
                        </Text>
                      </View>
                    ) : (
                      <FlatList
                        style={{ flexGrow: 0, flexShrink: 1 }}
                        data={invoicesHistory}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={[styles.empList, { paddingBottom: 100 }]}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                          <View style={[styles.empCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                            <View style={styles.empInfo}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={[styles.empNameText, { color: colors.text }]}>
                                  Рахунок {item.invoice_number}
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                                  {item.send_date}
                                </Text>
                              </View>
                              <Text style={[styles.empDetailsText, { color: colors.text, fontWeight: '500', marginVertical: 2 }]}>
                                {item.service_name}
                              </Text>
                              <Text style={[styles.empDetailsText, { color: colors.textMuted }]}>
                                Клієнт: {item.client_email}
                              </Text>

                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderColor: colors.border }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <Coins size={14} color={colors.success} style={{ marginRight: 4 }} />
                                  <Text style={[styles.empSalaryText, { color: colors.success }]}>
                                    {item.amount.toLocaleString('uk-UA')} ₴
                                  </Text>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  {item.act ? (
                                    <>
                                      <CheckCircle2 size={14} color={colors.success} style={{ marginRight: 4 }} />
                                      <Text style={{ fontSize: 12, color: colors.success, fontWeight: '600' }}>
                                        {item.document_type === 'waybill' ? 'Накладна' : 'Акт'} №{item.act.act_number}
                                      </Text>
                                    </>
                                  ) : (
                                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                      Без супутнього акту
                                    </Text>
                                  )}
                                </View>
                              </View>

                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border }}>
                                <Pressable
                                  onPress={() => handleDownloadInvoicePdf(item.id)}
                                  style={({ pressed }) => [
                                    {
                                      backgroundColor: colors.primaryMuted,
                                      opacity: pressed ? 0.7 : 1,
                                      paddingVertical: 6,
                                      paddingHorizontal: 12,
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: colors.primary + '33',
                                    }
                                  ]}
                                >
                                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: 'bold' }}>
                                    Рахунок PDF
                                  </Text>
                                </Pressable>

                                {item.act ? (
                                  <Pressable
                                    onPress={() => handleDownloadDocumentPdf(item.id)}
                                    style={({ pressed }) => [
                                      {
                                        backgroundColor: colors.successMuted,
                                        opacity: pressed ? 0.7 : 1,
                                        paddingVertical: 6,
                                        paddingHorizontal: 12,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: colors.success + '33',
                                      }
                                    ]}
                                  >
                                    <Text style={{ fontSize: 11, color: colors.success, fontWeight: 'bold' }}>
                                      {item.document_type === 'waybill' ? 'Накладна PDF' : 'Акт PDF'}
                                    </Text>
                                  </Pressable>
                                ) : (
                                  <>
                                    <Pressable
                                      onPress={() => handleCreateInvoiceDocument(item.id, 'act')}
                                      style={({ pressed }) => [
                                        {
                                          backgroundColor: colors.primaryMuted,
                                          opacity: pressed ? 0.7 : 1,
                                          paddingVertical: 6,
                                          paddingHorizontal: 10,
                                          borderRadius: 8,
                                          borderWidth: 1,
                                          borderColor: colors.primary + '22',
                                        }
                                      ]}
                                    >
                                      <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                                        + Створити Акт
                                      </Text>
                                    </Pressable>

                                    <Pressable
                                      onPress={() => handleCreateInvoiceDocument(item.id, 'waybill')}
                                      style={({ pressed }) => [
                                        {
                                          backgroundColor: colors.primaryMuted,
                                          opacity: pressed ? 0.7 : 1,
                                          paddingVertical: 6,
                                          paddingHorizontal: 10,
                                          borderRadius: 8,
                                          borderWidth: 1,
                                          borderColor: colors.primary + '22',
                                        }
                                      ]}
                                    >
                                      <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                                        + Накладну
                                      </Text>
                                    </Pressable>
                                  </>
                                )}
                              </View>
                            </View>
                          </View>
                        )}
                      />
                    )}
                  </View>
                )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      )}

      {/* Custom Send Date Confirmation Modal */}
      {sendConfirmModalVisible && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={sendConfirmModalVisible}
          onRequestClose={() => setSendConfirmModalVisible(false)}
        >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSendConfirmModalVisible(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            pointerEvents="box-none"
          >
            <View
              style={[
                styles.dialogContent,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.cardBorder,
                  maxHeight: Math.min(windowHeight * 0.85, windowHeight - keyboardHeight - 60),
                  flexGrow: 0,
                  flexShrink: 1,
                },
              ]}
            >
                <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.text, fontSize: 18 }]}>Надіслати рахунок та акт</Text>
                    <Pressable onPress={() => setSendConfirmModalVisible(false)} style={styles.closeBtn}>
                      <X size={20} color={colors.text} />
                    </Pressable>
                  </View>

                  <Text style={{ fontSize: 14, color: colors.text, marginBottom: 16 }}>
                    Ви дійсно хочете сформувати та надіслати документи для клієнта?
                  </Text>

                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: colors.text, fontSize: 14 }]}>Сформувати акт виконання</Text>
                    <Switch
                      value={sendIncludeAct}
                      onValueChange={setSendIncludeAct}
                      trackColor={{ false: '#767577', true: colors.primary }}
                      thumbColor={sendIncludeAct ? '#ffffff' : '#f4f3f4'}
                    />
                  </View>

                  <View style={[styles.switchRow, { marginTop: 8 }]}>
                    <Text style={[styles.switchLabel, { color: colors.text, fontSize: 14 }]}>Вказати власну дату документів</Text>
                    <Switch
                      value={customDateEnabled}
                      onValueChange={setCustomDateEnabled}
                      trackColor={{ false: '#767577', true: colors.primary }}
                      thumbColor={customDateEnabled ? '#ffffff' : '#f4f3f4'}
                    />
                  </View>

                  {customDateEnabled && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Input
                          label="День (1-31)"
                          placeholder="15"
                          value={customSendDay}
                          onChangeText={setCustomSendDay}
                          keyboardType="number-pad"
                          maxLength={2}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Input
                          label="Місяць (1-12)"
                          placeholder="5"
                          value={customSendMonth}
                          onChangeText={setCustomSendMonth}
                          keyboardType="number-pad"
                          maxLength={2}
                        />
                      </View>
                    </View>
                  )}

                  <View style={[styles.formActions, { marginTop: 16 }]}>
                    <Button
                      title="Скасувати"
                      onPress={() => setSendConfirmModalVisible(false)}
                      variant="outline"
                      style={styles.halfBtn}
                    />
                    <Button
                      title="Надіслати"
                      onPress={handleConfirmSendInvoice}
                      style={styles.halfBtn}
                    />
                  </View>
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
  emptyIcon: {
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    width: 200,
  },
  list: {
    padding: 16,
    paddingBottom: 88,
  },
  profileCard: {
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  briefcase: {
    marginRight: 10,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
  },
  actionBtn: {
    padding: 6,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
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
    padding: 16,
  },
  dialogContent: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    width: '95%',
    maxWidth: 400,
    maxHeight: Dimensions.get('window').height * 0.80,
    flexGrow: 0,
    flexShrink: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  formScroll: {
    paddingBottom: 120,
    flexGrow: 0,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: 'rgba(120, 120, 128, 0.1)',
    padding: 2,
    marginBottom: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
    paddingHorizontal: 4,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  switchDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  saveBtn: {
    marginTop: 20,
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  employeeForm: {
    paddingBottom: 20,
    flexGrow: 0,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  halfBtn: {
    flex: 1,
    marginHorizontal: 4,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  addEmpBtn: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCenter: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTextSmall: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubSmall: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  empList: {
    paddingBottom: 24,
    flexGrow: 0,
  },
  empCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  empInfo: {
    flex: 1,
  },
  empNameText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  empDetailsText: {
    fontSize: 12,
    marginBottom: 6,
  },
  salaryBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  empSalaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  empActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  empActionBtn: {
    padding: 8,
    marginLeft: 8,
  },
  periodicityBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(120, 120, 128, 0.2)',
  },
  periodicityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalInput: {
    height: 40,
    borderWidth: 1,
    paddingHorizontal: 12,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
  },
});
