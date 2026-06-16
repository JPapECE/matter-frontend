// screens/DashboardScreen.tsx
//
// Matches the Stitch "Dashboard" mockup:
//   - Sticky header: bolt icon + "Matter Home" + wifi icon
//   - Single "All Devices" filter chip
//   - 2-column grid of DeviceCards
//   - Offline cards: dimmed but toggle still works (optimistic UI for lazy CASE)
//   - FAB bottom-right (+)
//   - Bottom tab bar: Dashboard / Groups / Commission / Settings
//
// State: populated from GET /api/devices?withCapabilities=true on mount,
//        kept live via WebSocket state_change + energy_snapshot events.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialSymbols from '@expo/vector-icons/MaterialCommunityIcons';

import { Colors, Typography, Spacing, Radius, Shadows } from '../theme';
import { api }           from '../api/client';
import { getWsUrl, getApiBase } from '../api/config';
import { useWebSocket }  from '../hooks/useWebSocket';
import { DeviceCard }    from '../components/DeviceCard';
import { BottomTabBar }  from '../components/BottomTabBar';
import type { Device, WsEvent, WsStateChangeEvent, WsEnergySnapshotEvent } from '../types';
const { width } = Dimensions.get('window');
// Two cards per row with a 10px gutter between them
const CARD_GAP   = 10;
const CARD_WIDTH  = (width - Spacing.marginMobile * 2 - CARD_GAP) / 2;

interface Props {
  navigation: any;
}

export function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [devices, setDevices]       = useState<Device[]>([]);
  const [loading, setLoading]       = useState(true);
  const [gatewayOnline, setGatewayOnline] = useState(true);

  // Power badges: nodeId → watts
  const [powerMap, setPowerMap] = useState<Record<string, number | null>>({});

  // ── Fetch devices ──────────────────────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    try {
      const healthRes = await fetch(`${getApiBase().replace(/\/api$/, '')}/health`).then(r => r.json());
      setGatewayOnline(!!healthRes.gatewayOnline);
    } catch (err) {
      console.warn('[Dashboard] Failed to fetch gateway health:', err);
    }

    try {
      const data = await api.getDevices(true);
      setDevices(data);
    } catch (err) {
      console.error('[Dashboard] Failed to fetch devices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // ── WebSocket events ───────────────────────────────────────────────────────
  const handleWsEvent = useCallback((event: WsEvent) => {
    if (event.event === 'state_change') {
      const e = event as WsStateChangeEvent;
      setDevices(prev => prev.map(d => {
        if (d.nodeId !== e.nodeId) return d;
        if (e.attribute === 'onOff')        return { ...d, on:     e.value as boolean };
        if (e.attribute === 'currentLevel') return { ...d, level:  e.value as number  };
        if (e.attribute === 'online')       return { ...d, online: e.value as boolean };
        return d;
      }));
    }

    if (event.event === 'energy_snapshot') {
      const e = event as WsEnergySnapshotEvent;
      setPowerMap(prev => ({ ...prev, [e.nodeId]: e.power.activePower }));
    }

    if ((event as any).event === 'gateway_status') {
      const e = event as any;
      const isOnline = e.status === 'connected';
      setGatewayOnline(isOnline);
      if (!isOnline) {
        // Mark all devices offline locally if the gateway is disconnected
        setDevices(prev => prev.map(d => ({ ...d, online: false })));
      } else {
        // Trigger a fresh sync on gateway reconnection
        fetchDevices();
      }
    }
  }, [fetchDevices]);

  useWebSocket({ url: getWsUrl(), onEvent: handleWsEvent });

  // ── Toggle handler (optimistic — works even for offline devices) ───────────
  // Due to lazy CASE, matter.js will attempt mDNS discovery + CASE handshake
  // when the command is sent. If device is unreachable, the promise will reject
  // and we revert the UI. But we still let the user try — the device might just
  // have a stale "offline" status from the last poll.
  const handleToggle = useCallback(async (device: Device) => {
    const turnToOn = !device.on;

    // Optimistic update — immediate UI feedback
    setDevices(prev => prev.map(d =>
      d.nodeId === device.nodeId ? { ...d, on: turnToOn } : d
    ));

    try {
      if (turnToOn) {
        await api.turnOn(device.nodeId);
      } else {
        await api.turnOff(device.nodeId);
      }
    } catch {
      // Revert on failure
      setDevices(prev => prev.map(d =>
        d.nodeId === device.nodeId ? { ...d, on: device.on } : d
      ));
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} activeOpacity={0.7}>
          <MaterialSymbols name="lightning-bolt" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Matter Home</Text>

        <TouchableOpacity style={styles.headerIcon} onPress={fetchDevices} activeOpacity={0.7}>
          <MaterialSymbols 
            name={gatewayOnline ? "access-point" : "access-point-network-off"} 
            size={24} 
            color={gatewayOnline ? Colors.secondary : Colors.error} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Filter chip ── */}
        <View style={styles.chipRow}>
          <View style={[styles.chip, styles.chipActive]}>
            <Text style={[styles.chipLabel, styles.chipLabelActive]}>All Devices</Text>
          </View>
        </View>

        {/* ── Gateway Offline Warning ── */}
        {!gatewayOnline && (
          <View style={styles.warningBanner}>
            <MaterialSymbols name="alert-circle-outline" size={20} color={Colors.error} />
            <Text style={styles.warningText}>Matter Gateway is offline. Smart controls disabled.</Text>
          </View>
        )}

        {/* ── Device grid ── */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : devices.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={styles.grid}>
            {devices.map(device => (
              <DeviceCard
                key={device.nodeId}
                device={device}
                activePower={powerMap[device.nodeId] ?? null}
                onToggle={() => handleToggle(device)}
                onPress={() => navigation.navigate('DeviceDetail', { nodeId: device.nodeId })}
                cardWidth={CARD_WIDTH}
              />
            ))}
          </View>
        )}
      {/* bottom spacing so last card clears the FAB */}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        onPress={() => navigation.navigate('Commission')}
        activeOpacity={0.85}
      >
        <MaterialSymbols name="plus" size={28} color={Colors.onPrimary} />
      </TouchableOpacity>

      {/* ── Bottom tab bar ── */}
      <BottomTabBar
        active="dashboard"
        insetBottom={insets.bottom}
        onNavigate={(tab) => {
          if (tab === 'groups')     navigation.navigate('Groups');
          if (tab === 'commission') navigation.navigate('Commission');
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <MaterialSymbols name="home-outline" size={48} color={Colors.outline} />
      <Text style={styles.emptyText}>No devices yet. Tap + to commission your first device.</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 8,
  },
  warningText: {
    ...Typography.bodyMd,
    color: Colors.error,
    flex: 1,
  },

  // Header
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: Spacing.marginMobile,
    height:          56,
    backgroundColor: Colors.background,
  },
  headerIcon: {
    width:          Spacing.touchMin,
    height:         Spacing.touchMin,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   Radius.full,
  },
  headerRightActions: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,   // kept for potential future use
  },
  headerTitle: {
    ...Typography.headlineLg,
    color: Colors.primary,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.marginMobile,
    paddingTop:        Spacing.stackMd,
    gap:               Spacing.stackMd,
  },

  // Filter chips
  chipRow: {
    flexDirection: 'row',
    gap:           8,
    marginBottom:  4,
  },
  chip: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      Radius.full,
    backgroundColor:  Colors.surfaceContainerHigh,
    minHeight:        Spacing.touchMin,
  },
  chipActive: {
    backgroundColor: Colors.primaryContainer,
  },
  chipLabel: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
  },
  chipLabelActive: {
    color: Colors.onPrimaryContainer,
    fontWeight: '600',
  },

  // Grid — 2 cols, 10px gap, matching Stitch compact layout
  grid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            CARD_GAP,
  },

  // Loading
  loadingContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     80,
  },

  // Empty state
  emptyState: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     80,
    gap:            16,
  },
  emptyText: {
    ...Typography.bodyMd,
    color:     Colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth:  260,
  },

  // FAB
  fab: {
    position:        'absolute',
    right:           Spacing.marginMobile,
    width:           60,
    height:          60,
    borderRadius:    Radius.xl,
    backgroundColor: Colors.primaryContainer,
    alignItems:      'center',
    justifyContent:  'center',
    ...Shadows.elevated,
  },

  // Bottom tab bar styles removed — shared component handles them
});
