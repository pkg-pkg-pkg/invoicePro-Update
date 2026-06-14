import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { PurchaseStackParamList } from './types';
import PurchaseHubScreen from '../screens/purchase/PurchaseHubScreen';
import PurchaseBillsScreen from '../screens/purchase/PurchaseBillsScreen';
import PurchaseBillFormScreen from '../screens/purchase/PurchaseBillFormScreen';
import PurchaseOrdersScreen from '../screens/purchase/PurchaseOrdersScreen';
import VendorPaymentsScreen from '../screens/purchase/VendorPaymentsScreen';
import DebitNotesScreen from '../screens/purchase/DebitNotesScreen';
import ExpensesScreen from '../screens/purchase/ExpensesScreen';
import RecurringBillsScreen from '../screens/purchase/RecurringBillsScreen';

const Stack = createStackNavigator<PurchaseStackParamList>();

export default function PurchaseStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="PurchaseHub" component={PurchaseHubScreen} options={{ title: 'Purchase' }} />
      <Stack.Screen name="PurchaseBills" component={PurchaseBillsScreen} />
      <Stack.Screen name="PurchaseBillForm" component={PurchaseBillFormScreen} options={{ title: 'New Bill' }} />
      <Stack.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} />
      <Stack.Screen name="VendorPayments" component={VendorPaymentsScreen} />
      <Stack.Screen name="DebitNotes" component={DebitNotesScreen} />
      <Stack.Screen name="Expenses" component={ExpensesScreen} />
      <Stack.Screen name="RecurringBills" component={RecurringBillsScreen} />
    </Stack.Navigator>
  );
}
