import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import LoginScreen from '../screens/LoginScreen';
import PartiesScreen from '../screens/PartiesScreen';
import ProductsScreen from '../screens/ProductsScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import Icon from 'react-native-vector-icons/MaterialIcons';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: any }) => ({
        tabBarIcon: ({ color, size }: { color: string; size: number }) => {
          let iconName: string;

          if (route.name === 'Parties') {
            iconName = 'groups';
          } else if (route.name === 'Ledgers') {
            iconName = 'inventory';
          } else if (route.name === 'Entries') {
            iconName = 'receipt';
          } else if (route.name === 'Bills') {
            iconName = 'assessment';
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          } else {
            iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Parties" component={PartiesScreen} />
      <Tab.Screen name="Ledgers" component={ProductsScreen} />
      <Tab.Screen name="Entries" component={InvoicesScreen} />
      <Tab.Screen name="Bills" component={ReportsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainTabs} />
      )}
    </Stack.Navigator>
  );
}

