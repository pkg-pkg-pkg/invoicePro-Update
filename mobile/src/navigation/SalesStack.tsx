import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { SalesStackParamList } from './types';
import SalesHubScreen from '../screens/sales/SalesHubScreen';
import TaxInvoicesScreen from '../screens/sales/TaxInvoicesScreen';
import TaxInvoiceFormScreen from '../screens/sales/TaxInvoiceFormScreen';
import QuotationsScreen from '../screens/sales/QuotationsScreen';
import ProformaScreen from '../screens/sales/ProformaScreen';
import SalesOrdersScreen from '../screens/sales/SalesOrdersScreen';
import DispatchNotesScreen from '../screens/sales/DispatchNotesScreen';
import CollectionsScreen from '../screens/sales/CollectionsScreen';
import CreditAdjustmentsScreen from '../screens/sales/CreditAdjustmentsScreen';
import RecurringSalesScreen from '../screens/sales/RecurringSalesScreen';

const Stack = createStackNavigator<SalesStackParamList>();

export default function SalesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SalesHub" component={SalesHubScreen} options={{ title: 'Sales' }} />
      <Stack.Screen name="TaxInvoices" component={TaxInvoicesScreen} options={{ title: 'Tax Invoices' }} />
      <Stack.Screen name="TaxInvoiceForm" component={TaxInvoiceFormScreen} options={{ title: 'New Invoice' }} />
      <Stack.Screen name="Quotations" component={QuotationsScreen} />
      <Stack.Screen name="Proforma" component={ProformaScreen} />
      <Stack.Screen name="SalesOrders" component={SalesOrdersScreen} />
      <Stack.Screen name="DispatchNotes" component={DispatchNotesScreen} />
      <Stack.Screen name="Collections" component={CollectionsScreen} />
      <Stack.Screen name="CreditAdjustments" component={CreditAdjustmentsScreen} />
      <Stack.Screen name="RecurringSales" component={RecurringSalesScreen} options={{ title: 'Recurring' }} />
    </Stack.Navigator>
  );
}
