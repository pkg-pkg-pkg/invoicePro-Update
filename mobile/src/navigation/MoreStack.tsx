import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { MoreStackParamList } from './types';
import MoreMenuScreen from '../screens/more/MoreMenuScreen';
import ItemsHubScreen from '../screens/items/ItemsHubScreen';
import ItemsListScreen from '../screens/items/ItemsListScreen';
import ItemFormScreen from '../screens/items/ItemFormScreen';
import PriceListScreen from '../screens/items/PriceListScreen';
import InventoryAdjustmentScreen from '../screens/items/InventoryAdjustmentScreen';
import GodownMasterScreen from '../screens/items/GodownMasterScreen';
import BankingHubScreen from '../screens/banking/BankingHubScreen';
import BankAccountsScreen from '../screens/banking/BankAccountsScreen';
import LedgerAccountsScreen from '../screens/banking/LedgerAccountsScreen';
import ReceiptVouchersScreen from '../screens/banking/ReceiptVouchersScreen';
import PaymentVouchersScreen from '../screens/banking/PaymentVouchersScreen';
import PaymentReceiptDeskScreen from '../screens/banking/PaymentReceiptDeskScreen';
import JournalVouchersScreen from '../screens/banking/JournalVouchersScreen';
import CustomersScreen from '../screens/customers/CustomersScreen';
import CustomerFormScreen from '../screens/customers/CustomerFormScreen';
import CustomerLedgerScreen from '../screens/customers/CustomerLedgerScreen';
import ReportsMenuScreen from '../screens/reports/ReportsMenuScreen';
import GSTReportsScreen from '../screens/gst/GSTReportsScreen';
import GSTR1Screen from '../screens/gst/GSTR1Screen';
import GSTR2Screen from '../screens/gst/GSTR2Screen';
import GSTR3BScreen from '../screens/gst/GSTR3BScreen';
import GSTR9Screen from '../screens/gst/GSTR9Screen';
import HSNSummaryScreen from '../screens/gst/HSNSummaryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AccessRestrictedScreen from '../screens/AccessRestrictedScreen';

const Stack = createStackNavigator<MoreStackParamList>();

export default function MoreStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} options={{ title: 'More' }} />
      <Stack.Screen name="ItemsHub" component={ItemsHubScreen} options={{ title: 'Items' }} />
      <Stack.Screen name="ItemsList" component={ItemsListScreen} />
      <Stack.Screen name="ItemForm" component={ItemFormScreen} options={{ title: 'Item' }} />
      <Stack.Screen name="PriceLists" component={PriceListScreen} />
      <Stack.Screen name="InventoryAdjustments" component={InventoryAdjustmentScreen} />
      <Stack.Screen name="GodownMaster" component={GodownMasterScreen} />
      <Stack.Screen name="BankingHub" component={BankingHubScreen} options={{ title: 'Banking' }} />
      <Stack.Screen name="BankAccounts" component={BankAccountsScreen} />
      <Stack.Screen name="LedgerAccounts" component={LedgerAccountsScreen} />
      <Stack.Screen name="ReceiptVouchers" component={ReceiptVouchersScreen} />
      <Stack.Screen name="PaymentVouchers" component={PaymentVouchersScreen} />
      <Stack.Screen name="PaymentReceiptDesk" component={PaymentReceiptDeskScreen} />
      <Stack.Screen name="JournalVouchers" component={JournalVouchersScreen} />
      <Stack.Screen name="Customers" component={CustomersScreen} />
      <Stack.Screen name="CustomerForm" component={CustomerFormScreen} />
      <Stack.Screen name="CustomerLedger" component={CustomerLedgerScreen} />
      <Stack.Screen name="ReportsMenu" component={ReportsMenuScreen} options={{ title: 'Reports' }} />
      <Stack.Screen name="GSTReports" component={GSTReportsScreen} options={{ title: 'GST Reports' }} />
      <Stack.Screen name="GSTR1" component={GSTR1Screen} />
      <Stack.Screen name="GSTR2" component={GSTR2Screen} />
      <Stack.Screen name="GSTR3B" component={GSTR3BScreen} />
      <Stack.Screen name="GSTR9" component={GSTR9Screen} />
      <Stack.Screen name="HSNSummary" component={HSNSummaryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="AccessRestricted" component={AccessRestrictedScreen} options={{ title: 'Restricted' }} />
    </Stack.Navigator>
  );
}
