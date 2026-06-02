import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import PartiesScreen from '../screens/PartiesScreen';
import ProductsScreen from '../screens/ProductsScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OutstandingScreen from '../screens/OutstandingScreen';
import PayableScreen from '../screens/PayableScreen';
import Icon from 'react-native-vector-icons/MaterialIcons';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const MoreStack = createStackNavigator();

function MoreStackScreen() {
  return (
    <MoreStack.Navigator>
      <MoreStack.Screen name="Party Master" component={PartiesScreen} />
      <MoreStack.Screen name="Ledger Create" component={ProductsScreen} />
      <MoreStack.Screen name="Outstanding" component={OutstandingScreen} />
      <MoreStack.Screen name="Payable" component={PayableScreen} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
    </MoreStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: string } }) => ({
        headerShown: true,
        tabBarLabelStyle: { fontSize: 10 },
        tabBarIcon: ({ color, size }: { color: string; size: number }) => {
          const icons: Record<string, string> = {
            Home: 'dashboard',
            Sales: 'point-of-sale',
            Purchase: 'shopping-cart',
            Vouchers: 'receipt',
            More: 'menu',
          };
          return <Icon name={icons[route.name] || 'help'} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen
        name="Sales"
        component={ReportsScreen}
        initialParams={{ defaultInvoiceType: 'SALES_INVOICE' }}
      />
      <Tab.Screen
        name="Purchase"
        component={ReportsScreen}
        initialParams={{ defaultInvoiceType: 'PURCHASE_INVOICE' }}
      />
      <Tab.Screen name="Vouchers" component={InvoicesScreen} options={{ title: 'Receipt / Payment' }} />
      <Tab.Screen name="More" component={MoreStackScreen} options={{ headerShown: false }} />
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
