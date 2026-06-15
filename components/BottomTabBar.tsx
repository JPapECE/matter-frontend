// components/BottomTabBar.tsx
//
// Shared bottom navigation tab bar used by every screen.
// Previously copy-pasted into DashboardScreen, CommissionScreen, and GroupsScreen.
// Single source of truth — change tab labels/icons/styles here once.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialSymbols from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, Radius } from '../theme';

export type TabKey = 'dashboard' | 'groups' | 'commission';

export interface BottomTabBarProps {
  active:      TabKey;
  insetBottom: number;
  onNavigate:  (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'dashboard',  label: 'Dashboard',  icon: 'home'               },
  { key: 'groups',     label: 'Groups',     icon: 'account-group'      },
  { key: 'commission', label: 'Commission', icon: 'plus-circle-outline' },
];

export function BottomTabBar({ active, insetBottom, onNavigate }: BottomTabBarProps) {
  return (
    <View style={[styles.tabBar, { paddingBottom: insetBottom + 8 }]}>
      {TABS.map(tab => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, isActive && styles.tabItemActive]}
            onPress={() => onNavigate(tab.key)}
            activeOpacity={0.7}
          >
            <MaterialSymbols
              name={tab.icon as any}
              size={24}
              color={isActive ? Colors.secondary : Colors.onSurfaceVariant}
            />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection:     'row',
    backgroundColor:   Colors.surfaceContainerLow,
    paddingTop:        8,
    paddingHorizontal: Spacing.marginMobile,
    borderTopWidth:    1,
    borderTopColor:    Colors.outlineVariant,
  },
  tabItem: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             4,
    paddingVertical: 6,
    borderRadius:    Radius.lg,
    minHeight:       Spacing.touchMin,
  },
  tabItemActive: {
    backgroundColor: Colors.secondaryContainer + '33',
  },
  tabLabel: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  tabLabelActive: {
    color: Colors.secondary,
  },
});
