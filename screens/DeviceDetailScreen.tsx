// screens/DeviceDetailScreen.tsx
//
// Matches the "Virtual CT Light" detail mockup exactly:
//   - Sticky header: back arrow + device name + more_vert
//   - Device header card: name, lightbulb icon + type label, toggle
//   - Brightness section: percentage label, −/slider/+ controls
//   - Color Temperature section: gradient slider, Kelvin label, 3 preset pills
//   - Power metrics: 3-tile bento grid (Watts / Volts / Amps)
//   - Energy Monitoring entry row (navigates to energy screen)
//
// Sections are conditionally rendered based on capability flags.
// State is kept live via WebSocket state_change + energy_snapshot events.

import React, {
  useState, useEffect, useCallback, useRef, useMemo
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialSymbols from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, Typography, Spacing, Radius, Shadows } from '../theme';
import { api }           from '../api/client';
import { getWsUrl }      from '../api/config';
import { useWebSocket }  from '../hooks/useWebSocket';
import type {
  FullStatus, DeviceCapabilities, PowerReading, EnergyReading,
  WsEvent, WsStateChangeEvent, WsEnergySnapshotEvent,
} from '../types';

interface Props {
  navigation: any;
  route:      { params: { nodeId: string } };
}

// Kelvin → 0–1 slider position within device range (0 = left/minK, 1 = right/maxK)
function kelvinToPosition(k: number, minK: number, maxK: number): number {
  const range = maxK - minK;
  if (range === 0) return 0;
  return (k - minK) / range;
}
function positionToKelvin(pos: number, minK: number, maxK: number): number {
  return Math.round(minK + pos * (maxK - minK));
}

// CT presets
const CT_PRESETS = [
  { label: 'Relax',  kelvin: 2700 },
  { label: 'Read',   kelvin: 4000 },
  { label: 'Focus',  kelvin: 6500 },
];

// ─────────────────────────────────────────────────────────────────────────────

export function DeviceDetailScreen({ navigation, route }: Props) {
  const { nodeId }  = route.params;
  const insets      = useSafeAreaInsets();

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(true);
  const [deviceName, setDeviceName] = useState('');
  const [online,   setOnline]   = useState<boolean>(true);
  const [isOn,     setIsOn]     = useState<boolean | null>(null);
  const [level,    setLevel]    = useState<number>(254);
  const [caps,     setCaps]     = useState<DeviceCapabilities | null>(null);
  const [power,    setPower]    = useState<PowerReading | null>(null);
  const [energy,   setEnergy]   = useState<EnergyReading | null>(null);

  // CT state (Kelvin)
  const [ctKelvin, setCtKelvin] = useState<number>(4000);
  const minK = caps?.colorTempMinKelvin ?? 2700; // min kelvin = warmest
  const maxK = caps?.colorTempMaxKelvin ?? 6500; // max kelvin = coolest

  // Optimistic revert timer
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevOn      = useRef<boolean | null>(null);

  // User interaction tracking refs and timers
  const lastLevelInteractionTime = useRef<number>(0);
  const lastCtInteractionTime    = useRef<number>(0);
  const latestWsLevel            = useRef<number | null>(null);
  const latestWsCt               = useRef<number | null>(null);
  const levelSyncTimeout         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctSyncTimeout            = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync with state for immediate use in callbacks
  const levelRef = useRef(level);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  const ctRef = useRef(ctKelvin);
  useEffect(() => {
    ctRef.current = ctKelvin;
  }, [ctKelvin]);

  // Toggle animation
  const thumbAnim = useRef(new Animated.Value(isOn ? 1 : 0)).current;

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [devices, fullStatus, capData] = await Promise.all([
          api.getDevices(),
          api.getFullStatus(nodeId),
          api.getCapabilities(nodeId),
        ]);

        const dev = devices.find(d => d.nodeId === nodeId);
        setDeviceName(dev ? dev.name : (capData.deviceType || 'Device'));
        setOnline(fullStatus.status.online);
        setIsOn(fullStatus.status.on);
        if (fullStatus.status.level !== null) setLevel(fullStatus.status.level);
        setCaps(capData);
        setPower(fullStatus.power);
        setEnergy(fullStatus.energy);

        if (capData.hasColorTemperature) {
          const ctData = await api.getColorTemperature(nodeId);
          if (ctData.kelvin) setCtKelvin(ctData.kelvin);
        }
      } catch (err) {
        console.error('[DeviceDetail] Load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [nodeId]);

  // ── Sync toggle animation to state ────────────────────────────────────────
  useEffect(() => {
    Animated.timing(thumbAnim, {
      toValue:         isOn ? 1 : 0,
      duration:        200,
      useNativeDriver: false,
    }).start();
  }, [isOn, thumbAnim]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (levelSyncTimeout.current) clearTimeout(levelSyncTimeout.current);
      if (ctSyncTimeout.current) clearTimeout(ctSyncTimeout.current);
    };
  }, []);

  const thumbTranslate = thumbAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [2, 22],
  });
  const trackColor = thumbAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [Colors.surfaceVariant, Colors.primaryContainer],
  });

  const recordLevelInteraction = useCallback((targetValue: number) => {
    lastLevelInteractionTime.current = Date.now();
    if (levelSyncTimeout.current) clearTimeout(levelSyncTimeout.current);
    levelSyncTimeout.current = setTimeout(() => {
      if (latestWsLevel.current !== null) {
        setLevel(latestWsLevel.current);
        latestWsLevel.current = null;
      }
    }, 2500);
  }, []);

  const recordCtInteraction = useCallback((targetKelvin: number) => {
    lastCtInteractionTime.current = Date.now();
    if (ctSyncTimeout.current) clearTimeout(ctSyncTimeout.current);
    ctSyncTimeout.current = setTimeout(() => {
      if (latestWsCt.current !== null) {
        setCtKelvin(latestWsCt.current);
        latestWsCt.current = null;
      }
    }, 2500);
  }, []);

  // ── WebSocket events ───────────────────────────────────────────────────────
  const handleWsEvent = useCallback((event: WsEvent) => {
    if (event.event === 'state_change') {
      const e = event as WsStateChangeEvent;
      if (e.nodeId !== nodeId) return;
      if (e.attribute === 'onOff')        setIsOn(e.value as boolean);
      
      if (e.attribute === 'currentLevel') {
        const val = e.value as number;
        if (Date.now() - lastLevelInteractionTime.current < 2500) {
          latestWsLevel.current = val;
        } else {
          setLevel(val);
          latestWsLevel.current = null;
        }
      }
      
      if (e.attribute === 'colorTemperature') {
        const v = e.value as { mireds: number; kelvin: number };
        if (v.kelvin) {
          if (Date.now() - lastCtInteractionTime.current < 2500) {
            latestWsCt.current = v.kelvin;
          } else {
            setCtKelvin(v.kelvin);
            latestWsCt.current = null;
          }
        }
      }
      if (e.attribute === 'online')       setOnline(e.value as boolean);
    }
    if (event.event === 'energy_snapshot') {
      const e = event as WsEnergySnapshotEvent;
      if (e.nodeId !== nodeId) return;
      setPower(e.power);
      setEnergy(e.energy);
    }
  }, [nodeId]);

  useWebSocket({ url: getWsUrl(), nodeId, onEvent: handleWsEvent });

  // ── Commands ───────────────────────────────────────────────────────────────

  const handleToggle = useCallback(async () => {
    prevOn.current = isOn;
    const next = !isOn;
    setIsOn(next);

    // Set 3s revert timer
    revertTimer.current = setTimeout(() => {
      setIsOn(prevOn.current); // revert if no WS confirmation
    }, 3000);

    try {
      await api.toggle(nodeId);
      clearTimeout(revertTimer.current!);
    } catch {
      clearTimeout(revertTimer.current!);
      setIsOn(prevOn.current);
    }
  }, [isOn, nodeId]);

  const handleLevelChange = useCallback(async (value: number) => {
    const rounded = Math.round(value);
    setLevel(rounded);
    recordLevelInteraction(rounded);
  }, [recordLevelInteraction]);

  const handleLevelSlidingComplete = useCallback(async (value: number) => {
    const rounded = Math.round(value);
    recordLevelInteraction(rounded);
    try { await api.setLevel(nodeId, rounded, 5); } catch {}
  }, [nodeId, recordLevelInteraction]);

  const handleLevelStep = useCallback(async (direction: 'up' | 'down') => {
    const step = 25;
    const current = levelRef.current;
    const next = direction === 'up'
      ? Math.min(254, current + step)
      : Math.max(1,   current - step);
    
    // Update ref immediately so subsequent rapid clicks see the new value
    levelRef.current = next;
    setLevel(next);
    recordLevelInteraction(next);
    try { await api.setLevel(nodeId, next, 5); } catch {}
  }, [nodeId, recordLevelInteraction]);

  const handleCtChange = useCallback((value: number) => {
    // Slider gives 0–1 position; convert to kelvin
    const kelvin = positionToKelvin(value, minK, maxK);
    setCtKelvin(kelvin);
    recordCtInteraction(kelvin);
  }, [minK, maxK, recordCtInteraction]);

  const handleCtSlidingComplete = useCallback(async (value: number) => {
    const kelvin = positionToKelvin(value, minK, maxK);
    recordCtInteraction(kelvin);
    try { await api.setColorTemperature(nodeId, { kelvin }, 10); } catch {}
  }, [nodeId, minK, maxK, recordCtInteraction]);

  const handleCtStep = useCallback(async (direction: 'up' | 'down') => {
    const step = 500; // Kelvin step
    const current = ctRef.current;
    let nextKelvin = current;
    // direction 'down' (minus button / left side) -> decreases Kelvin (warmer)
    // direction 'up' (plus button / right side) -> increases Kelvin (cooler)
    if (direction === 'up') {
      nextKelvin = Math.min(maxK, current + step);
    } else {
      nextKelvin = Math.max(minK, current - step);
    }

    ctRef.current = nextKelvin;
    setCtKelvin(nextKelvin);
    recordCtInteraction(nextKelvin);
    try {
      await api.setColorTemperature(nodeId, { kelvin: nextKelvin }, 10);
    } catch {}
  }, [nodeId, minK, maxK, recordCtInteraction]);

  const handleCtPreset = useCallback((kelvin: number) => {
    // Clamp to device range
    const clampedK = Math.max(minK, Math.min(maxK, kelvin));
    setCtKelvin(clampedK);
    recordCtInteraction(clampedK);
    try { api.setColorTemperature(nodeId, { kelvin: clampedK }, 10); } catch {}
  }, [nodeId, minK, maxK, recordCtInteraction]);

  const handleDecommission = useCallback(() => {
    Alert.alert(
      'Decommission Device',
      'Are you sure you want to decommission this device? This will remove the device from the Matter fabric and delete all stored data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decommission',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.removeDevice(nodeId);
              navigation.navigate('Dashboard');
            } catch (err: any) {
              setLoading(false);
              Alert.alert('Error', err.message || 'Failed to decommission device.');
            }
          },
        },
      ]
    );
  }, [nodeId, navigation]);

  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      await api.getCapabilities(nodeId, true);
      const [devices, fullStatus, capData] = await Promise.all([
        api.getDevices(),
        api.getFullStatus(nodeId),
        api.getCapabilities(nodeId),
      ]);

      const dev = devices.find(d => d.nodeId === nodeId);
      setDeviceName(dev ? dev.name : (capData.deviceType || 'Device'));
      setOnline(fullStatus.status.online);
      setIsOn(fullStatus.status.on);
      if (fullStatus.status.level !== null) setLevel(fullStatus.status.level);
      setCaps(capData);
      setPower(fullStatus.power);
      setEnergy(fullStatus.energy);

      if (capData.hasColorTemperature) {
        const ctData = await api.getColorTemperature(nodeId);
        if (ctData.kelvin) setCtKelvin(ctData.kelvin);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to refresh capabilities.');
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  // Derived display values
  const levelPct      = Math.round((level / 254) * 100);
  const currentKelvin = ctKelvin;
  const ctPosition    = kelvinToPosition(ctKelvin, minK, maxK);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.loadingRoot, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const headerTitleText = caps?.deviceType === 'ColorTemperatureLight' ? 'Virtual CT Light' :
                          caps?.deviceType === 'DimmablePlugInUnit'    ? 'Dimmable Plug-In Unit' :
                          caps?.deviceType === 'OnOffPlugInUnit'       ? 'Smart Plug' : 'Device';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialSymbols name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>{headerTitleText}</Text>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleRefresh}
          activeOpacity={0.7}
        >
          <MaterialSymbols name="refresh" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Offline Banner ── */}
      {!online && (
        <View style={styles.offlineBanner}>
          <MaterialSymbols name="cloud-off" size={18} color={Colors.onErrorContainer} />
          <Text style={styles.offlineBannerText}>
            Device Offline - Commands will resume once reconnected.
          </Text>
        </View>
      )}

      {/* ── Scrollable content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Device header card ── */}
        <View style={styles.card}>
          <View style={styles.deviceHeaderLeft}>
            <Text style={styles.deviceName}>{deviceName}</Text>
            <View style={styles.deviceTypeRow}>
              <MaterialSymbols name="lightbulb-outline" size={14} color={Colors.onSurfaceVariant} />
              <Text style={styles.deviceTypeLabel}>
                {caps?.deviceType === 'ColorTemperatureLight' ? 'Color Temperature Light' :
                 caps?.deviceType === 'DimmablePlugInUnit'    ? 'Dimmable Plug-In Unit'   :
                 caps?.deviceType === 'OnOffPlugInUnit'       ? 'Smart Plug'              : 'Device'}
              </Text>
            </View>
          </View>

          {/* Toggle */}
          <TouchableOpacity onPress={handleToggle} activeOpacity={0.85} style={styles.toggleHitArea}>
            <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
              <Animated.View style={[styles.thumb, { transform: [{ translateX: thumbTranslate }] }]} />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* ── Brightness section ── */}
        {caps?.hasLevelControl && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>BRIGHTNESS</Text>
              <Text style={styles.sectionValue}>{levelPct}%</Text>
            </View>

            <View style={styles.sliderRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => handleLevelStep('down')}
                activeOpacity={0.7}
              >
                <MaterialSymbols name="minus" size={22} color={Colors.onSurface} />
              </TouchableOpacity>

              <View style={styles.sliderWrapper}>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={254}
                  value={level}
                  step={1}
                  onValueChange={handleLevelChange}
                  onSlidingComplete={handleLevelSlidingComplete}
                  minimumTrackTintColor={Colors.primary}
                  maximumTrackTintColor={Colors.surfaceVariant}
                  thumbTintColor={Colors.onBackground}
                />
              </View>

              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => handleLevelStep('up')}
                activeOpacity={0.7}
              >
                <MaterialSymbols name="plus" size={22} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Color Temperature section ── */}
        {caps?.hasColorTemperature && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>COLOR TEMPERATURE</Text>
              <Text style={styles.sectionValue}>{currentKelvin}K</Text>
            </View>

            <View style={[styles.sliderRow, { marginBottom: 16 }]}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => handleCtStep('down')}
                activeOpacity={0.7}
              >
                <MaterialSymbols name="minus" size={22} color={Colors.onSurface} />
              </TouchableOpacity>

              <View style={styles.sliderWrapper}>
                <View style={styles.ctSliderContainer}>
                  <LinearGradient
                    colors={['#fbbf24', '#ffffff', '#60a5fa']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctTrackGradient}
                  />
                  <Slider
                    style={styles.ctSlider}
                    minimumValue={0}
                    maximumValue={1}
                    value={ctPosition}
                    step={0.001}
                    onValueChange={handleCtChange}
                    onSlidingComplete={handleCtSlidingComplete}
                    minimumTrackTintColor="transparent"
                    maximumTrackTintColor="transparent"
                    thumbTintColor={Colors.onBackground}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => handleCtStep('up')}
                activeOpacity={0.7}
              >
                <MaterialSymbols name="plus" size={22} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>

            {/* Preset pills */}
            <View style={styles.presetRow}>
              {CT_PRESETS.map(preset => {
                const isActive = Math.abs(currentKelvin - preset.kelvin) < 200;
                // Only show presets within the device's supported range
                const inRange = preset.kelvin >= minK && preset.kelvin <= maxK;
                if (!inRange) return null;
                return (
                  <TouchableOpacity
                    key={preset.kelvin}
                    style={[styles.presetPill, isActive && styles.presetPillActive]}
                    onPress={() => handleCtPreset(preset.kelvin)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetLabel, isActive && styles.presetLabelActive]}>
                      {preset.label} ({preset.kelvin}K)
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Power metrics bento ── */}
        {caps?.hasElectricalPower && (
          <View style={styles.bentoRow}>
            <MetricTile
              icon="lightning-bolt"
              iconColor={Colors.tertiary}
              value={power?.activePower?.toFixed(1) ?? '—'}
              unit="Watts"
            />
            <MetricTile
              icon="power-plug-outline"
              iconColor={Colors.coolSpectrum}
              value={power?.voltage?.toFixed(1) ?? '—'}
              unit="Volts"
            />
            <MetricTile
              icon="meter-electric-outline"
              iconColor={Colors.secondary}
              value={power?.current?.toFixed(3) ?? '—'}
              unit="Amps"
            />
          </View>
        )}

        {/* ── Energy Monitoring entry row ── */}
        {(caps?.hasElectricalEnergy || caps?.hasElectricalPower) && (
          <TouchableOpacity
            style={styles.energyEntryRow}
            onPress={() => navigation.navigate('EnergyMonitoring', { nodeId })}
            activeOpacity={0.8}
          >
            <View style={styles.energyEntryIcon}>
              <MaterialSymbols name="chart-line" size={24} color={Colors.primary} />
            </View>
            <View style={styles.energyEntryText}>
              <Text style={styles.energyEntryTitle}>Energy Monitoring</Text>
              <Text style={styles.energyEntrySubtitle}>View detailed usage and trends</Text>
            </View>
            <MaterialSymbols name="chevron-right" size={24} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}

        {/* ── Decommission section ── */}
        <View style={styles.decommissionSection}>
          <TouchableOpacity
            style={styles.decommissionBtn}
            onPress={handleDecommission}
            activeOpacity={0.8}
          >
            <MaterialSymbols name="link-off" size={20} color={Colors.onErrorContainer} />
            <Text style={styles.decommissionBtnText}>DECOMMISSION DEVICE</Text>
          </TouchableOpacity>
          <Text style={styles.decommissionSubtext}>
            This will remove the device from the Matter fabric and delete all stored data.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MetricTile sub-component
// ─────────────────────────────────────────────────────────────────────────────

interface MetricTileProps {
  icon:       string;
  iconColor:  string;
  value:      string;
  unit:       string;
}

function MetricTile({ icon, iconColor, value, unit }: MetricTileProps) {
  return (
    <View style={styles.metricTile}>
      <MaterialSymbols name={icon as any} size={26} color={iconColor} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricUnit}>{unit}</Text>
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
  loadingRoot: {
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.marginMobile,
    height:            56,
  },
  headerBtn: {
    width:          Spacing.touchMin,
    height:         Spacing.touchMin,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   Radius.full,
  },
  headerTitle: {
    ...Typography.headlineLg,
    color:  Colors.primary,
    flex:   1,
    textAlign: 'center',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.marginMobile,
    paddingTop:        Spacing.stackMd,
    gap:               Spacing.stackMd,
  },

  // Generic card
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius:    Radius.xl,
    padding:         16,
    ...Shadows.card,
  },

  // Device header card
  deviceHeaderLeft: { flex: 1 },
  deviceHeaderRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deviceName: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
  },
  deviceTypeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginTop:     4,
  },
  deviceTypeLabel: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },

  // Toggle
  toggleHitArea: {
    width:          Spacing.touchMin + 16,
    height:         Spacing.touchMin,
    alignItems:     'flex-end',
    justifyContent: 'center',
  },
  track: {
    width:             56,
    height:            32,
    borderRadius:      Radius.full,
    justifyContent:    'center',
    paddingHorizontal: 2,
  },
  thumb: {
    width:           28,
    height:          28,
    borderRadius:    Radius.full,
    backgroundColor: Colors.surfaceCard,
    ...Shadows.elevated,
  },

  // Sections
  sectionHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   16,
  },
  sectionLabel: {
    ...Typography.labelMd,
    color:          Colors.onSurfaceVariant,
    textTransform:  'uppercase',
    letterSpacing:  1.2,
  },
  sectionValue: {
    ...Typography.dataNumeric,
    color: Colors.primary,
  },

  // Brightness slider row
  sliderRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  stepBtn: {
    width:          Spacing.touchMin,
    height:         Spacing.touchMin,
    borderRadius:   Radius.full,
    backgroundColor: Colors.surfaceVariant,
    alignItems:     'center',
    justifyContent: 'center',
  },
  sliderWrapper: { flex: 1 },
  slider:        { width: '100%', height: 40 },

  // CT slider
  ctSliderContainer: {
    position:     'relative',
    justifyContent: 'center',
    height: 40,
  },
  ctTrackGradient: {
    height:       8,
    borderRadius: Radius.full,
    marginHorizontal: 14, // account for thumb overhang
  },
  ctSlider: {
    ...StyleSheet.absoluteFillObject,
    width:  '100%',
    height: 40,
  },

  // CT presets
  presetRow: {
    flexDirection:  'row',
    gap:            8,
    flexWrap:       'wrap',
  },
  presetPill: {
    flex:              1,
    paddingVertical:   10,
    borderRadius:      Radius.lg,
    backgroundColor:   Colors.surfaceVariant,
    alignItems:        'center',
    borderWidth:       1,
    borderColor:       Colors.outlineVariant + '4D',
    minHeight:         Spacing.touchMin,
    justifyContent:    'center',
  },
  presetPillActive: {
    backgroundColor: Colors.primary + '33',  // 20% opacity
    borderColor:     Colors.primary + '80',
  },
  presetLabel: {
    ...Typography.labelSm,
    color: Colors.onSurface,
  },
  presetLabelActive: {
    color: Colors.primary,
  },

  // Power metrics bento
  bentoRow: {
    flexDirection: 'row',
    gap:           Spacing.gutterMobile,
  },
  metricTile: {
    flex:            1,
    backgroundColor: Colors.surfaceCard,
    borderRadius:    Radius.xl,
    padding:         14,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             4,
    ...Shadows.card,
  },
  metricValue: {
    ...Typography.dataNumeric,
    color: Colors.onSurface,
  },
  metricUnit: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },

  // Energy entry row
  energyEntryRow: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius:    Radius.xl,
    padding:         16,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    minHeight:       Spacing.touchMin + 16,
    ...Shadows.card,
  },
  energyEntryIcon: {
    width:           40,
    height:          40,
    borderRadius:    Radius.full,
    backgroundColor: Colors.primary + '1A',
    alignItems:      'center',
    justifyContent:  'center',
  },
  energyEntryText:     { flex: 1 },
  energyEntryTitle: {
    ...Typography.bodyLg,
    color:      Colors.onSurface,
    fontWeight: '600',
  },
  energyEntrySubtitle: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
  },

  // Offline banner
  offlineBanner: {
    backgroundColor: Colors.errorContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.marginMobile,
    paddingVertical: 10,
    gap: 8,
  },
  offlineBannerText: {
    ...Typography.bodyMd,
    color: Colors.onErrorContainer,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Decommission section
  decommissionSection: {
    marginTop: 24,
    marginBottom: 16,
    alignItems: 'center',
    gap: 8,
  },
  decommissionBtn: {
    width: '100%',
    height: Spacing.touchMin + 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.errorContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  decommissionBtnText: {
    ...Typography.labelMd,
    color: Colors.onErrorContainer,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  decommissionSubtext: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
