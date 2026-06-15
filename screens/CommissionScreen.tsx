// screens/CommissionScreen.tsx
//
// Matches the Stitch "QR Commissioning with Optional WiFi" mockup:
//   - Sticky header: bolt + "Matter Home" + wifi_tethering
//   - Camera-based QR scanner with corner brackets and scan-line animation
//   - "Position QR code within frame" label below scanner
//   - Network Connection section with toggle:
//       "Is the device already on your WiFi?"
//       If yes → skip WiFi fields (IP-path commissioning)
//       If no  → show SSID & password inputs (BLE/WiFi provisioning)
//   - Device Name input
//   - Reboot note for troubleshooting
//   - "Commission Device" CTA button
//   - Bottom navigation bar with "Commission" tab active
//

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialSymbols from '@expo/vector-icons/MaterialCommunityIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { Colors, Typography, Spacing, Radius, Shadows } from '../theme';
import { api } from '../api/client';
import { BottomTabBar } from '../components/BottomTabBar';

interface Props {
  navigation: any;
}

type ScanStatus = 'scanning' | 'loading' | 'scanned';

export function CommissionScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  // ── Camera Permissions ─────────────────────────────────────────────────────
  const [permission, requestPermission] = useCameraPermissions();

  // ── State ──────────────────────────────────────────────────────────────────
  const [scanStatus, setScanStatus]   = useState<ScanStatus>('scanning');
  const [pairingCode, setPairingCode] = useState('');
  const [deviceAlreadyOnWifi, setDeviceAlreadyOnWifi] = useState(false);
  const [wifiSsid, setWifiSsid]       = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [deviceName, setDeviceName]   = useState('');
  const [commissioning, setCommissioning] = useState(false);

  // ── Scan Animation ─────────────────────────────────────────────────────────
  const scanAnim = useRef(new Animated.Value(0.1)).current;
  const scanAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (scanStatus === 'scanning') {
      scanAnimationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 0.9,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(scanAnim, {
            toValue: 0.1,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      );
      scanAnimationRef.current.start();
    } else {
      if (scanAnimationRef.current) {
        scanAnimationRef.current.stop();
      }
      scanAnim.setValue(0.1);
    }

    return () => {
      if (scanAnimationRef.current) {
        scanAnimationRef.current.stop();
      }
    };
  }, [scanStatus, scanAnim]);

  const scanLineTop = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ── Camera Handlers ────────────────────────────────────────────────────────
  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (scanStatus !== 'scanning') return;
    setScanStatus('scanned');
    setPairingCode(data);

    // Attempt to guess device name or use default
    if (data.startsWith('MT:')) {
      setDeviceName('Test Plug 1');
    } else {
      setDeviceName('Scanned Device');
    }
  }, [scanStatus]);

  const handleSimulateScan = useCallback(() => {
    setScanStatus('loading');
    setTimeout(() => {
      setScanStatus('scanned');
      setPairingCode('MT:A9CA00O614GA5K7GZ10');
      setDeviceName('Test Plug 1');
      setWifiSsid('VODAFONE_H268Q-9662');
      setWifiPassword('Papaderospito61!');
    }, 1200);
  }, []);

  const handleCommission = useCallback(async () => {
    if (!pairingCode) {
      Alert.alert('Scan QR Code', 'Please scan a Matter QR code or use the simulator fallback first.');
      return;
    }

    setCommissioning(true);
    try {
      // If the device is already on WiFi (IP path), don't send wifi credentials.
      // If it's NOT on WiFi, send the SSID & password for BLE provisioning.
      const wifiPayload = deviceAlreadyOnWifi
        ? undefined
        : (wifiSsid ? { ssid: wifiSsid, password: wifiPassword } : undefined);

      const res = await api.commission(
        pairingCode,
        deviceName || 'Test Plug 1',
        'smart-plug',
        wifiPayload
      );

      Alert.alert(
        'Success',
        `Device "${res.name}" commissioned successfully! (Node ID: ${res.nodeId})`,
        [
          {
            text: 'OK',
            onPress: () => {
              setScanStatus('scanning');
              setPairingCode('');
              setDeviceName('');
              setWifiSsid('');
              setWifiPassword('');
              setDeviceAlreadyOnWifi(false);
              navigation.navigate('Dashboard');
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('[Commission] Error:', err);
      Alert.alert('Commissioning Failed', err.message || 'An error occurred while commissioning the device.');
    } finally {
      setCommissioning(false);
    }
  }, [pairingCode, deviceName, deviceAlreadyOnWifi, wifiSsid, wifiPassword, navigation]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} activeOpacity={0.7}>
          <MaterialSymbols name="lightning-bolt" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Matter Home</Text>

        <TouchableOpacity style={styles.headerIcon} activeOpacity={0.7}>
          <MaterialSymbols name="access-point" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page Title ── */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Add New Device</Text>
          <Text style={styles.pageSubtitle}>Scan the Matter QR code to begin pairing.</Text>
        </View>

        {/* ── Scanner Card ── */}
        <View style={styles.scannerCard}>
          <View style={styles.viewfinderContainer}>
            <View style={styles.viewfinder}>
              {/* Corner brackets */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Viewfinder States */}
              {scanStatus === 'loading' && (
                <View style={styles.overlayWrapper}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.stateText}>Reading QR Code...</Text>
                </View>
              )}

              {scanStatus === 'scanned' && (
                <View style={styles.overlayWrapper}>
                  <MaterialSymbols name="check-circle" size={64} color={Colors.secondary} />
                  <Text style={styles.stateText}>Code Detected!</Text>
                  <Text style={styles.pairingCodeValue} numberOfLines={1}>{pairingCode}</Text>
                  <TouchableOpacity
                    style={styles.scanAgainBtn}
                    onPress={() => {
                      setScanStatus('scanning');
                      setPairingCode('');
                    }}
                  >
                    <Text style={styles.scanAgainBtnText}>Scan Again</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Camera Rendering when state is 'scanning' */}
              {scanStatus === 'scanning' && (
                <>
                  {!permission ? (
                    <View style={styles.overlayWrapper}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                    </View>
                  ) : !permission.granted ? (
                    <View style={styles.overlayWrapper}>
                      <MaterialSymbols name="camera-off" size={40} color={Colors.outline} />
                      <Text style={styles.permissionText}>Camera permission required</Text>
                      <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                        <Text style={styles.grantBtnText}>Grant Permission</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.grantBtnSimulate} onPress={handleSimulateScan}>
                        <Text style={styles.grantBtnSimulateText}>Use Simulator Fallback</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={StyleSheet.absoluteFillObject}>
                      <CameraView
                        style={StyleSheet.absoluteFillObject}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        onBarcodeScanned={handleBarcodeScanned}
                      />
                      <Animated.View style={[styles.scanLine, { top: scanLineTop }]} />
                    </View>
                  )}
                </>
              )}
            </View>
          </View>

          {/* Scanner label */}
          <Text style={styles.scannerLabel}>Position QR code within frame</Text>

          {scanStatus === 'scanning' && permission?.granted && (
            <TouchableOpacity style={styles.scannerDevBtn} onPress={handleSimulateScan}>
              <Text style={styles.scannerDevBtnText}>Simulate Successful Scan (Dev Fallback)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Network Connection Section ── */}
        <View style={styles.formContainer}>
          <View style={styles.formSection}>
            <View style={styles.sectionHeaderRow}>
              <MaterialSymbols name="wifi" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Network Connection</Text>
            </View>

            {/* WiFi Toggle Card */}
            <View style={styles.formCard}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>
                    Is the device already on your WiFi?
                  </Text>
                  <Text style={styles.toggleDescription}>
                    If yes, we'll skip WiFi setup. If no, please enter your credentials below.
                  </Text>
                </View>
                <Switch
                  value={deviceAlreadyOnWifi}
                  onValueChange={setDeviceAlreadyOnWifi}
                  trackColor={{
                    false: Colors.outlineVariant,
                    true: Colors.secondary + '80',
                  }}
                  thumbColor={deviceAlreadyOnWifi ? Colors.secondary : Colors.outline}
                />
              </View>

              {/* WiFi Credentials — shown only when device is NOT already on WiFi */}
              {!deviceAlreadyOnWifi && (
                <>
                  {/* WiFi SSID Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>WiFi SSID (Network Name)</Text>
                    <View style={styles.inputWrapper}>
                      <MaterialSymbols
                        name="router-wireless"
                        size={20}
                        color={Colors.outlineVariant}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Home_Network_5G"
                        placeholderTextColor={Colors.outlineVariant}
                        value={wifiSsid}
                        onChangeText={setWifiSsid}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  {/* WiFi Password Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>WiFi Password</Text>
                    <View style={styles.inputWrapper}>
                      <MaterialSymbols
                        name="lock"
                        size={20}
                        color={Colors.outlineVariant}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor={Colors.outlineVariant}
                        secureTextEntry
                        value={wifiPassword}
                        onChangeText={setWifiPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Provisioning Note */}
            {!deviceAlreadyOnWifi && (
              <View style={styles.noteRow}>
                <MaterialSymbols name="information" size={18} color={Colors.primary} />
                <Text style={styles.noteText}>
                  These credentials will be securely provisioned to your device during the commissioning process.
                </Text>
              </View>
            )}
          </View>

          {/* Device Name Section */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Device Name</Text>
            <View style={styles.inputWrapper}>
              <MaterialSymbols
                name="pencil"
                size={20}
                color={Colors.outlineVariant}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. Living Room Light"
                placeholderTextColor={Colors.outlineVariant}
                value={deviceName}
                onChangeText={setDeviceName}
              />
            </View>
          </View>

          {/* Reboot Troubleshooting Note */}
          <View style={styles.noteRow}>
            <MaterialSymbols name="alert-circle-outline" size={18} color={Colors.tertiary} />
            <Text style={styles.noteTextWarn}>
              Note: if the device is not found, try a quick reboot (unplug and plug it back in) before commissioning.
            </Text>
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity
            style={[
              styles.commissionBtn,
              !pairingCode && styles.commissionBtnDisabled,
            ]}
            onPress={handleCommission}
            disabled={commissioning || !pairingCode}
            activeOpacity={0.85}
          >
            {commissioning ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <>
                <MaterialSymbols name="plus-circle" size={24} color={Colors.onPrimary} />
                <Text style={styles.commissionBtnText}>Commission Device</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Bottom tab bar ── */}
      <BottomTabBar
        active="commission"
        insetBottom={insets.bottom}
        onNavigate={(tab) => {
          if (tab === 'dashboard')  navigation.navigate('Dashboard');
          if (tab === 'groups')     navigation.navigate('Groups');
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BottomTabBar Sub-component
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.marginMobile,
    height: 56,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerHigh + '80',
  },
  headerIcon: {
    width: Spacing.touchMin,
    height: Spacing.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  headerTitle: {
    ...Typography.headlineLg,
    color: Colors.primary,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.marginMobile,
    paddingTop: Spacing.stackMd,
    gap: 24,
  },

  // Title Section
  titleSection: {
    gap: 4,
  },
  pageTitle: {
    ...Typography.headlineLg,
    color: Colors.onSurface,
  },
  pageSubtitle: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },

  // Scanner Card
  scannerCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    ...Shadows.card,
  },
  viewfinderContainer: {
    width: '100%',
    maxWidth: 240,
    aspectRatio: 1,
  },
  viewfinder: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
    overflow: 'hidden',
    position: 'relative',
  },
  overlayWrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 14, 25, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  stateText: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  permissionText: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
  scanAgainBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radius.md,
  },
  scanAgainBtnText: {
    ...Typography.labelSm,
    color: Colors.onPrimaryContainer,
  },
  grantBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  grantBtnText: {
    ...Typography.labelSm,
    color: Colors.onPrimary,
  },
  grantBtnSimulate: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Radius.md,
  },
  grantBtnSimulateText: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 5,
  },

  // Viewfinder Corner Brackets
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: Colors.primary,
    zIndex: 15,
  },
  cornerTL: {
    top: 16,
    left: 16,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 16,
    right: 16,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 16,
    left: 16,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 16,
    right: 16,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },
  pairingCodeValue: {
    ...Typography.labelSm,
    color: Colors.secondary,
    backgroundColor: Colors.secondaryContainer + '1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    width: '100%',
    textAlign: 'center',
  },
  scannerLabel: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    marginTop: 16,
    textAlign: 'center',
  },
  scannerDevBtn: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '4D',
    borderRadius: Radius.md,
  },
  scannerDevBtnText: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },

  // Form Setup
  formContainer: {
    gap: 24,
  },
  formSection: {
    gap: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    ...Typography.headlineMd,
    fontSize: 18,
    color: Colors.onSurface,
  },
  formCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    gap: 20,
    ...Shadows.card,
  },

  // Toggle Row (WiFi on/off)
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleTextContainer: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  toggleDescription: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },

  // Inputs
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Radius.lg,
    height: 48,
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingLeft: 40,
    paddingRight: 16,
    color: Colors.onSurface,
    ...Typography.bodyMd,
  },

  // Info Note
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  noteText: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 18,
  },
  noteTextWarn: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 18,
  },

  // Commission Button
  commissionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 52,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  commissionBtnDisabled: {
    backgroundColor: Colors.primary + '4D',
    shadowOpacity: 0,
    elevation: 0,
  },
  commissionBtnText: {
    ...Typography.headlineMd,
    color: Colors.onPrimary,
  },

  // Bottom Tab Bar styles removed — shared BottomTabBar component handles them
});
