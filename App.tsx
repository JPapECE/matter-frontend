import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import your custom screens
import { DashboardScreen } from './screens/DashboardScreen';
import { GroupsScreen } from './screens/GroupsScreen';
import { DeviceDetailScreen } from './screens/DeviceDetailScreen';
import { CommissionScreen } from './screens/CommissionScreen';
import { EnergyMonitoringScreen } from './screens/EnergyMonitoringScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Dashboard"
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#0f0f0f' },
          }}
        >
          {/* Main Home Screen */}
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          
          {/* Detailed Device Screen 
              FIX: Cast component as any to allow strict navigation prop passing */}
          <Stack.Screen 
            name="DeviceDetail" 
            component={DeviceDetailScreen as any} 
          />
          
          {/* Placeholders */}
          <Stack.Screen name="Groups" component={GroupsScreen as any} />
          <Stack.Screen name="Commission" component={CommissionScreen as any} />
          <Stack.Screen name="Settings" component={DashboardScreen} />
          
          {/* Energy Monitoring Dashboard */}
          <Stack.Screen 
            name="EnergyMonitoring" 
            component={EnergyMonitoringScreen as any} 
          />
          
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}