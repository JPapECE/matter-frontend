import 'react-native-gesture-handler';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import { DashboardScreen }       from './screens/DashboardScreen';
import { GroupsScreen }          from './screens/GroupsScreen';
import { DeviceDetailScreen }    from './screens/DeviceDetailScreen';
import { CommissionScreen }      from './screens/CommissionScreen';
import { EnergyMonitoringScreen } from './screens/EnergyMonitoringScreen';

// Connection mode hook
import { useConnectionMode, type ConnectionMode } from './hooks/useConnectionMode';

const Stack = createStackNavigator();

// ── Connection mode banner ────────────────────────────────────────────────────

const MODE_CONFIG: Record<ConnectionMode, { label: string; color: string; bg: string }> = {
  detecting: { label: 'Connecting…',    color: '#94a3b8', bg: 'rgba(30,30,40,0.85)' },
  local:     { label: 'Local Network',  color: '#4ade80', bg: 'rgba(20,40,20,0.85)' },
  cloud:     { label: 'Cloud',          color: '#60a5fa', bg: 'rgba(20,20,40,0.85)' },
  offline:   { label: 'Offline',        color: '#f87171', bg: 'rgba(40,20,20,0.85)' },
};

function ConnectionBanner({ mode }: { mode: ConnectionMode }) {
  const insets = useSafeAreaInsets();
  const cfg = MODE_CONFIG[mode];
  // Don't show anything while detecting or when in normal cloud mode
  if (mode === 'detecting' || mode === 'cloud') return null;
  return (
    <View style={[banner.bar, { top: insets.top + 4, backgroundColor: cfg.bg }]}>
      <View style={[banner.dot, { backgroundColor: cfg.color }]} />
      <Text style={[banner.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const banner = StyleSheet.create({
  bar: {
    position: 'absolute',
    right: 12,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
    elevation: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

// ── Root app ──────────────────────────────────────────────────────────────────

function AppInner() {
  const mode = useConnectionMode();

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Dashboard"
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#0f0f0f' },
          }}
        >
          <Stack.Screen name="Dashboard"       component={DashboardScreen} />
          <Stack.Screen name="DeviceDetail"    component={DeviceDetailScreen as any} />
          <Stack.Screen name="Groups"          component={GroupsScreen as any} />
          <Stack.Screen name="Commission"      component={CommissionScreen as any} />
          <Stack.Screen name="Settings"        component={DashboardScreen} />
          <Stack.Screen name="EnergyMonitoring" component={EnergyMonitoringScreen as any} />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Floating connection mode badge — top-right corner */}
      <ConnectionBanner mode={mode} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}