import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { LayoutDashboard, Briefcase, Receipt, FileText, Settings, Users } from 'lucide-react-native';

export default function TabLayout() {
  const { colors, isDark } = useTheme();

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
          title: 'Дашборд',
          headerShown: false,
          tabBarLabel: 'Головна',
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
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Транзакції',
          headerTitle: 'Імпорт та облік транзакцій',
          tabBarLabel: 'Операції',
          tabBarIcon: ({ color, size }) => <Receipt size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Рахунки',
          headerTitle: 'Рахунки (Сформувати та відправити)',
          tabBarLabel: 'Рахунки',
          tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: 'Білінг',
          headerTitle: 'Облік мешканців та внесків',
          tabBarLabel: 'Білінг',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Налаштування',
          headerTitle: 'Налаштування системи',
          tabBarLabel: 'Налаштування',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
