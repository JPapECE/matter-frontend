// components/DeviceCard.tsx
//
// Dashboard device card — matches the updated Stitch Dashboard mockup:
//   - Status dot top-left (green = online, red = offline)
//   - Toggle switch top-right (always interactive for optimistic lazy CASE)
//   - Device name bottom-left
//   - "Offline" badge bottom-right when offline
//   - Compact height (≈ 80px)
//   - Active "on" state: subtle blue inner glow

import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';

import { Colors, Typography, Spacing, Radius, Shadows } from '../theme';
import type { Device } from '../types';

interface Props {
  device:      Device;
  activePower: number | null; // from WebSocket energy_snapshot (reserved for detail view)
  cardWidth:   number;
  onToggle:    () => void;
  onPress:     () => void;   // navigate to DeviceDetail
}

export function DeviceCard({ device, cardWidth, onToggle, onPress }: Props) {
  const { online, on, name } = device;

  // Animated toggle thumb
  const thumbAnim = useRef(new Animated.Value(on ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(thumbAnim, {
      toValue:         on ? 1 : 0,
      duration:        200,
      useNativeDriver: false,
    }).start();
  }, [on, thumbAnim]);

  const thumbTranslate = thumbAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [2, 20],
  });

  const trackColor = thumbAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [Colors.surfaceVariant, Colors.primaryContainer],
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width: cardWidth },
        on && online && styles.cardActive,
        !online && styles.cardOffline,
        pressed && styles.cardPressed,
      ]}
    >
      {/* ── Status dot (top-left) ── */}
      <View style={[styles.statusDot, online ? styles.dotOnline : styles.dotOffline]} />

      {/* ── Toggle + spacer row ── */}
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onToggle(); }}
          activeOpacity={0.8}
          style={styles.toggleHitArea}
        >
          <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
            <Animated.View
              style={[
                styles.thumb,
                { transform: [{ translateX: thumbTranslate }] },
              ]}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* ── Footer: name + offline label ── */}
      <View style={styles.footer}>
        <Text style={[styles.deviceName, !online && styles.deviceNameOffline]} numberOfLines={1}>
          {name}
        </Text>
        {!online && (
          <Text style={styles.offlineLabel}>Offline</Text>
        )}
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius:    Radius.lg,
    padding:         12,
    height:          88,
    justifyContent:  'space-between',
    ...Shadows.card,
  },
  cardActive: {
    borderWidth:   1,
    borderColor:   Colors.primary + '1A',
    shadowColor:   Colors.primary,
    shadowOpacity: 0.10,
    shadowRadius:  16,
  },
  cardOffline: {
    opacity: 0.5,
  },
  cardPressed: {
    opacity: 0.82,
  },

  // Status dot
  statusDot: {
    position:     'absolute',
    top:          12,
    left:         12,
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: Colors.secondaryFixed,  // bright green
  },
  dotOffline: {
    backgroundColor: Colors.error,           // red
  },

  // Top toggle row
  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-end',
    marginTop:      4,
  },
  toggleHitArea: {
    width:          Spacing.touchMin,
    height:         Spacing.touchMin,
    alignItems:     'flex-end',
    justifyContent: 'center',
  },
  track: {
    width:        44,
    height:       24,
    borderRadius: Radius.full,
    justifyContent: 'center',
  },
  thumb: {
    width:           20,
    height:          20,
    borderRadius:    Radius.full,
    backgroundColor: Colors.surfaceCard,
    ...Shadows.elevated,
  },

  // Footer
  footer: {
    gap: 2,
  },
  deviceName: {
    ...Typography.labelMd,
    color:      Colors.onSurface,
    fontWeight: '500',
    fontSize:   13,
  },
  deviceNameOffline: {
    color: Colors.onSurfaceVariant,
  },
  offlineLabel: {
    ...Typography.labelSm,
    color: Colors.error,
  },
});
