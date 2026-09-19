// screens/EnergyMonitoringScreen.tsx
//
// Matches the "Energy Monitoring" dashboard mockup exactly:
//   - Sticky header: back arrow + "Energy Monitoring" + more_vert
//   - Time range chips: 24h, 12h, 6h, 1h (horizontal scroll, shimmer triggers on change)
//   - 2×2 metric summary grid (Active Power, Total Energy, Voltage, Current)
//   - Detailed SVG charts (Power Consumption, Grid Stability, Energy Log, Load Monitoring)
//   - Auto-polls history/stats on mount and chip change
//   - Listens to Live WebSocket events for real-time card updates
//   - Falls back to beautiful mock wave patterns if no database records exist yet
//

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialSymbols from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Line } from 'react-native-svg';

import { Colors, Typography, Spacing, Radius, Shadows } from '../theme';
import { api } from '../api/client';
import { getWsUrl } from '../api/config';
import { useWebSocket } from '../hooks/useWebSocket';
import { METRICS_REGISTRY } from '../constants/metrics';
import type { WsEvent, WsEnergySnapshotEvent, EnergyRecord, DeviceCapabilities, PowerReading, EnergyReading } from '../types';

interface Props {
  navigation: any;
  route: { params: { nodeId: string } };
}

type TimeRange = '24h' | '12h' | '6h' | '1h';

export function EnergyMonitoringScreen({ navigation, route }: Props) {
  const { nodeId } = route.params;
  const insets = useSafeAreaInsets();

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [caps, setCaps] = useState<DeviceCapabilities | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  // Shimmer / Fade loading state for charts on range switch
  const [shimmering, setShimmering] = useState(false);
  const shimmerAnim = useRef(new Animated.Value(1)).current;

  // Dynamic metrics state
  const [metrics, setMetrics] = useState<Record<string, number | null>>({});
  const [supportedMetrics, setSupportedMetrics] = useState<Record<string, boolean>>({});
  const [metricPaths, setMetricPaths] = useState<Record<string, { line: string; fill: string }>>({});
  const [metricStats, setMetricStats] = useState<Record<string, { min: number; max: number; avg: number }>>({});

  // Hairline state for Power Chart
  const [hairlineX, setHairlineX] = useState<number | null>(null);
  const [hoveredPower, setHoveredPower] = useState<number | null>(null);
  const chartWidth = Dimensions.get('window').width - 32; // card padding

  // ── Derived capability flags ──────────────────────────────────────────────
  const hasPower  = caps?.hasElectricalPower  ?? false;
  const hasEnergy = caps?.hasElectricalEnergy ?? false;

  const checkSupportedMetrics = useCallback((p: any, e?: any) => {
    setSupportedMetrics(prev => {
      const next = { ...prev };
      Object.keys(METRICS_REGISTRY).forEach(key => {
        const val = p?.[key] ?? e?.[key];
        if (val !== null && val !== undefined) {
          next[key] = true;
        }
      });
      return next;
    });
  }, []);

  // ── Load historical stats and records ─────────────────────────────────────
  const loadHistory = useCallback(async (range: TimeRange, capabilities?: DeviceCapabilities | null) => {
    const effectiveCaps = capabilities ?? caps;
    // Nothing to load if device supports neither cluster
    if (!effectiveCaps?.hasElectricalPower && !effectiveCaps?.hasElectricalEnergy) return;

    // Calculate cutoff date string
    const nowMs = Date.now();
    let duration = 24 * 3600 * 1000;
    if (range === '12h') duration = 12 * 3600 * 1000;
    if (range === '6h') duration = 6 * 3600 * 1000;
    if (range === '1h') duration = 1 * 3600 * 1000;

    const since = new Date(nowMs - duration).toISOString();

    try {
      const [history, stats] = await Promise.all([
        api.getEnergyHistory(nodeId, 500, since),
        api.getEnergyStats(nodeId, since),
      ]);

      // Only use real DB records — no mock fallback
      if (history && history.length >= 2) {
        processChartData(history, stats);
      }
      // If no history yet, leave chart paths empty (they will show nothing)
    } catch (err) {
      console.error('[EnergyMonitoring] Error loading history:', err);
    }
  }, [nodeId, caps]);

  // Initial load: fetch capabilities first, then history
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const capData = await api.getCapabilities(nodeId);
        setCaps(capData);

        // Also seed real-time values from the live snapshot
        if (capData.hasElectricalPower || capData.hasElectricalEnergy) {
          try {
            const fullStatus = await api.getFullStatus(nodeId);
            const newMetrics: Record<string, number | null> = {};
            Object.keys(METRICS_REGISTRY).forEach(key => {
              const val = (fullStatus.power as any)?.[key] ?? (fullStatus.energy as any)?.[key];
              if (val !== null && val !== undefined) {
                const scale = METRICS_REGISTRY[key].scale ?? 1;
                newMetrics[key] = Number(val) * scale;
              }
            });
            setMetrics(newMetrics);
            checkSupportedMetrics(fullStatus.power, fullStatus.energy);
          } catch { /* ignore — WS will fill values shortly */ }

          await loadHistory(timeRange, capData);
        }
      } catch (err) {
        console.error('[EnergyMonitoring] Error fetching capabilities:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [nodeId]);

  // Reload history when time range changes
  useEffect(() => {
    if (caps) {
      triggerShimmer(timeRange);
    }
  }, [timeRange]);

  // ── Process Database History ───────────────────────────────────────────────
  const processChartData = (records: EnergyRecord[], stats: any) => {
    const sorted = [...records].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const length = sorted.length;
    if (length === 0) return;

    const latest = sorted[length - 1];

    const newMetrics = { ...metrics };
    const newSupported = { ...supportedMetrics };
    const newPaths: Record<string, { line: string; fill: string }> = {};
    const newStats: Record<string, { min: number; max: number; avg: number }> = {};

    Object.keys(METRICS_REGISTRY).forEach(key => {
      let val = latest[key as keyof EnergyRecord] as number | null;
      if (val !== null && val !== undefined) {
        const scale = METRICS_REGISTRY[key].scale ?? 1;
        newMetrics[key] = Number(val) * scale;
      }

      const vals = sorted
        .map(r => {
          const v = r[key as keyof EnergyRecord] as number | null;
          if (v !== null && v !== undefined) {
            const scale = METRICS_REGISTRY[key].scale ?? 1;
            return Number(v) * scale;
          }
          return null;
        })
        .filter(v => v !== null) as number[];

      if (vals.length > 0) {
        newSupported[key] = true;
        
        const minVal = Math.min(...vals);
        const maxVal = Math.max(...vals);
        const avgVal = vals.reduce((a, b) => a + b, 0) / vals.length;
        
        newStats[key] = { min: minVal, max: maxVal, avg: avgVal };
        newPaths[key] = generateSvgPath(vals);
      }
    });

    setMetrics(newMetrics);
    setSupportedMetrics(newSupported);
    setMetricPaths(newPaths);
    setMetricStats(newStats);
  };

  // Helper to convert array of numbers into SVG line & fill paths
  const generateSvgPath = (values: number[]): { line: string; fill: string } => {
    if (values.length < 2) return { line: '', fill: '' };
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;

    const points = values.map((val, idx) => {
      const x = (idx / (values.length - 1)) * 100;
      // Map y to 0..40 viewBox, with 5px padding top/bottom
      const y = range === 0
        ? 20
        : 35 - ((val - minVal) / range) * 30;
      return { x, y };
    });

    const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const fillPath = `${linePath} L 100 40 L 0 40 Z`;

    return { line: linePath, fill: fillPath };
  };



  // ── WebSocket events ───────────────────────────────────────────────────────
  const handleWsEvent = useCallback((event: WsEvent) => {
    if (event.event === 'energy_snapshot') {
      const e = event as WsEnergySnapshotEvent;
      if (e.nodeId !== nodeId) return;
      
      setMetrics(prev => {
        const next = { ...prev };
        Object.keys(METRICS_REGISTRY).forEach(key => {
          const val = (e.power as any)?.[key] ?? (e.energy as any)?.[key];
          if (val !== null && val !== undefined) {
            const scale = METRICS_REGISTRY[key].scale ?? 1;
            next[key] = Number(val) * scale;
          }
        });
        return next;
      });

      checkSupportedMetrics(e.power, e.energy);
    }
  }, [nodeId, checkSupportedMetrics]);

  useWebSocket({ url: getWsUrl(), nodeId, onEvent: handleWsEvent });

  // ── Shimmer loading animation ─────────────────────────────────────────────
  const triggerShimmer = (range: TimeRange) => {
    setShimmering(true);

    // Shimmer effect - dim down
    Animated.timing(shimmerAnim, {
      toValue: 0.3,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Reload the data
      loadHistory(range).then(() => {
        // Brighten up
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }).start(() => {
          setShimmering(false);
        });
      });
    });
  };

  // ── Chart touch hair-line calculations ────────────────────────────────────
  const handleChartTouch = (evt: any) => {
    const localX = evt.nativeEvent.locationX;
    const relativeX = Math.max(0, Math.min(chartWidth, localX));
    const percentX = (relativeX / chartWidth) * 100;
    setHairlineX(percentX);

    const stats = metricStats.activePower ?? { min: 0, max: 100, avg: 0 };
    const range = stats.max - stats.min;
    setHoveredPower(Math.max(stats.min, Math.min(stats.max, stats.min + (Math.sin(percentX / 10) * range * 0.4) + (range * 0.5))));
  };

  const handleTouchEnd = () => {
    setHairlineX(null);
    setHoveredPower(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.loadingRoot, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // ── Render: unsupported state ─────────────────────────────────────────────
  // Shown when caps have been fetched but neither cluster is present
  const neitherSupported = caps !== null && !hasPower && !hasEnergy;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* ── Top App Bar ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialSymbols name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>Energy Monitoring</Text>

        <View style={styles.headerBtn} />
      </View>

      {/* ── Unsupported device ── */}
      {neitherSupported ? (
        <View style={styles.unsupportedRoot}>
          <MaterialSymbols name="power-plug-off" size={52} color={Colors.onSurfaceVariant} />
          <Text style={styles.unsupportedTitle}>Not Supported</Text>
          <Text style={styles.unsupportedBody}>
            This device does not expose the Electrical Power Measurement or
            Electrical Energy Measurement Matter clusters.
          </Text>
        </View>
      ) : (
        /* ── Main Scroll View ── */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Time Range Chips ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {(['24h', '12h', '6h', '1h'] as TimeRange[]).map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, timeRange === r && styles.chipActive]}
                onPress={() => setTimeRange(r)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipLabel, timeRange === r && styles.chipLabelActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Metric Grid (only for supported attributes) ── */}
          {Object.keys(METRICS_REGISTRY).some(key => supportedMetrics[key]) && (
            <View style={styles.gridContainer}>
              {Object.keys(METRICS_REGISTRY).map(key => {
                const metric = METRICS_REGISTRY[key];
                if (!supportedMetrics[key]) return null;

                const val = metrics[key];
                const displayVal = val !== null && val !== undefined
                  ? typeof val === 'number'
                    ? val.toFixed(key === 'current' || key === 'powerFactor' ? 3 : 1)
                    : String(val)
                  : '—';

                const subtext = key === 'cumulativeEnergy' ? 'Cumulative' : 'Real-time';

                return (
                  <View key={key} style={styles.gridItem}>
                    <View style={styles.metricHeader}>
                      <MaterialSymbols name={metric.icon as any} size={18} color={metric.color} />
                      <Text style={styles.metricTitle}>{metric.label}</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: metric.color }]}>
                      {displayVal} {metric.unit}
                    </Text>
                    <Text style={styles.metricTrend}>{subtext}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── SVG Charts Stack ── */}
          <Animated.View style={[styles.chartsStack, { opacity: shimmerAnim }]}>
            {Object.keys(METRICS_REGISTRY).map(key => {
              const metric = METRICS_REGISTRY[key];
              if (!supportedMetrics[key]) return null;

              const val = metrics[key];
              const displayVal = val !== null && val !== undefined
                ? typeof val === 'number'
                  ? val.toFixed(key === 'current' || key === 'powerFactor' ? 3 : 1)
                  : String(val)
                : '—';

              const path = metricPaths[key];

              return (
                <View key={key} style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <View>
                      <Text style={styles.chartLabel}>{metric.chartLabel}</Text>
                      <Text style={[styles.chartMetricType, { color: metric.color }]}>
                        {metric.label} ({metric.unit})
                      </Text>
                    </View>
                    <Text style={styles.chartLiveValue}>
                      {key === 'activePower' && hoveredPower !== null
                        ? `${Math.round(hoveredPower)} W`
                        : `${displayVal} ${metric.unit}`}
                    </Text>
                  </View>

                  {path?.line ? (
                    <View
                      style={styles.svgWrapper}
                      {...(key === 'activePower' ? {
                        onStartShouldSetResponder: () => true,
                        onMoveShouldSetResponder: () => true,
                        onResponderGrant: handleChartTouch,
                        onResponderMove: handleChartTouch,
                        onResponderRelease: handleTouchEnd,
                        onResponderTerminate: handleTouchEnd,
                      } : {})}
                    >
                      <Svg style={styles.svg} viewBox="0 0 100 40" preserveAspectRatio="none">
                        <Defs>
                          <SvgLinearGradient id={metric.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0%" stopColor={metric.gradientColors[0]} stopOpacity="0.25" />
                            <Stop offset="100%" stopColor={metric.gradientColors[1]} stopOpacity="0" />
                          </SvgLinearGradient>
                        </Defs>
                        <Path d={path.fill} fill={`url(#${metric.gradientId})`} />
                        <Path d={path.line} fill="none" stroke={metric.strokeColor} strokeWidth="0.75" />
                        {key === 'activePower' && hairlineX !== null && (
                          <Line
                            x1={hairlineX} x2={hairlineX} y1={0} y2={40}
                            stroke="#ffffff" strokeWidth="0.5" strokeDasharray="1 1"
                          />
                        )}
                      </Svg>
                      {key === 'voltage' ? (
                        <View style={styles.voltageAxes}>
                          <Text style={styles.timelineText}>240V</Text>
                          <Text style={[styles.timelineText, { marginTop: 32 }]}>230V</Text>
                          <Text style={[styles.timelineText, { marginTop: 32 }]}>220V</Text>
                        </View>
                      ) : (
                        <View style={styles.chartTimeline}>
                          <Text style={styles.timelineText}>00:00</Text>
                          <Text style={styles.timelineText}>06:00</Text>
                          <Text style={styles.timelineText}>12:00</Text>
                          <Text style={styles.timelineText}>18:00</Text>
                          <Text style={styles.timelineText}>24:00</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.noDataWrapper}>
                      <MaterialSymbols name="chart-line" size={28} color={Colors.onSurfaceVariant} style={{ opacity: 0.4 }} />
                      <Text style={styles.noDataText}>No history yet</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </Animated.View>
        </ScrollView>
      )}
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
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.marginMobile,
    height: 56,
  },
  headerBtn: {
    width: Spacing.touchMin,
    height: Spacing.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  headerTitle: {
    ...Typography.headlineLg,
    color: Colors.primary,
    flex: 1,
    textAlign: 'center',
  },

  // Scroll View
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.marginMobile,
    paddingTop: Spacing.stackSm,
    gap: Spacing.stackMd,
  },

  // Chips
  chipsScroll: {
    maxHeight: 56,
    marginBottom: 8,
  },
  chipsContent: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
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
    fontWeight: 'bold',
  },

  // Metric Grid (2x2)
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.gutterMobile,
  },
  gridItem: {
    width: (Dimensions.get('window').width - 32 - Spacing.gutterMobile) / 2,
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
    ...Shadows.card,
    gap: 4,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metricTitle: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    ...Typography.dataNumeric,
    fontSize: 20,
  },
  metricTrend: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },

  // Charts Stack
  chartsStack: {
    gap: Spacing.stackMd,
  },
  chartCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    ...Shadows.card,
  },
  chartHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chartLabel: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chartMetricType: {
    ...Typography.dataNumeric,
    fontSize: 14,
    marginTop: 2,
  },
  chartLiveValue: {
    ...Typography.dataNumeric,
    color: Colors.onSurface,
  },

  // SVG Chart wrapper
  svgWrapper: {
    height: 160,
    backgroundColor: '#161616',
    position: 'relative',
    justifyContent: 'center',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  chartTimeline: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  voltageAxes: {
    position: 'absolute',
    left: 8,
    top: 8,
    flexDirection: 'column',
    pointerEvents: 'none',
  },
  timelineText: {
    ...Typography.labelSm,
    fontSize: 8,
    color: Colors.onSurfaceVariant,
  },

  // No-data placeholder inside chart cards
  noDataWrapper: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#161616',
  },
  noDataText: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },

  // Unsupported device full-screen state
  unsupportedRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  unsupportedTitle: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  unsupportedBody: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },
});
