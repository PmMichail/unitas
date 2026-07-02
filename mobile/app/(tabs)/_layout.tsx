import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Briefcase, Receipt, FileText, Settings, Users, MessageSquare, BarChart3 } from 'lucide-react-native';

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { isResident } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: isDark ? '#0b0f19' : '#ffffff',
          borderTopColor: colors.cardBorder,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        headerStyle: {
          backgroundColor: isDark ? '#0b0f19' : '#ffffff',
          borderBottomColor: colors.cardBorder,
          borderBottomWidth: 1,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '700',
        },
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isResident ? 'Кабінет' : 'Дашборд',
          headerShown: false,
          tabBarLabel: isResident ? 'Кабінет' : 'Головна',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profiles"
        options={{
          title: 'Профілі',
          headerTitle: 'Податкові профілі',
          tabBarLabel: 'Профілі',
          tabBarIcon: ({ color, size }) => <Briefcase size={size} color={color} />,
          href: isResident ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: isResident ? 'Прозорість' : 'Транзакції',
          headerTitle: isResident ? 'Реєстр прозорості' : 'Імпорт та облік транзакцій',
          tabBarLabel: isResident ? 'Прозорість' : 'Операції',
          tabBarIcon: ({ color, size }) => isResident ? <Users size={size} color={color} /> : <Receipt size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: isResident ? 'Опитування' : 'Контрагентам',
          headerTitle: isResident ? 'Опитування та голосування' : 'Контрагентам (Рахунки та Акти)',
          tabBarLabel: isResident ? 'Опитування' : 'Контрагентам',
          tabBarIcon: ({ color, size }) => isResident ? <BarChart3 size={size} color={color} /> : <FileText size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: isResident ? 'Заявки' : 'Білінг',
          headerTitle: isResident ? 'Технічна підтримка та заявки' : 'Облік мешканців та внесків',
          tabBarLabel: isResident ? 'Заявки' : 'Білінг',
          tabBarIcon: ({ color, size }) => isResident ? <MessageSquare size={size} color={color} /> : <Users size={size} color={color} />,
          href: undefined,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Налаштування',
          headerTitle: isResident ? 'Налаштування кабінету' : 'Налаштування системи',
          tabBarLabel: 'Налаштування',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
