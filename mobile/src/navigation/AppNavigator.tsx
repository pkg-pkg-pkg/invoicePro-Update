import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootState } from '../store';
import LoginScreen from '../screens/LoginScreen';
import SuperAdminScreen from '../screens/superadmin/SuperAdminScreen';
import DashboardScreen from '../screens/DashboardScreen';
import DayBookScreen from '../screens/daybook/DayBookScreen';
import SalesStack from './SalesStack';
import PurchaseStack from './PurchaseStack';
import MoreStack from './MoreStack';

const RootStack = createStackNavigator();
const Tab = createBottomTabNavigator();

function DashboardTab({ navigation }: { navigation: { navigate: (name: string, params?: object) => void } }) {
  return <DashboardScreen navigation={navigation} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: string } }) => ({
        headerShown: true,
        tabBarLabelStyle: { fontSize: 10 },
        tabBarIcon: ({ color, size }: { color: string; size: number }) => {
          const icons: Record<string, string> = {
            Dashboard: 'dashboard',
            Sales: 'point-of-sale',
            Purchase: 'shopping-cart',
            DayBook: 'book',
            More: 'menu',
          };
          return <Icon name={icons[route.name] || 'help'} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardTab} />
      <Tab.Screen name="Sales" component={SalesStack} options={{ headerShown: false }} />
      <Tab.Screen name="Purchase" component={PurchaseStack} options={{ headerShown: false }} />
      <Tab.Screen name="DayBook" component={DayBookScreen} options={{ title: 'Day Book' }} />
      <Tab.Screen name="More" component={MoreStack} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const superAdminMode = useSelector((state: RootState) => state.auth.superAdminMode);

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {superAdminMode ? (
        <RootStack.Screen name="SuperAdmin" component={SuperAdminScreen} />
      ) : !isAuthenticated ? (
        <RootStack.Screen name="Login" component={LoginScreen} />
      ) : (
        <RootStack.Screen name="Main" component={MainTabs} />
      )}
    </RootStack.Navigator>
  );
}
