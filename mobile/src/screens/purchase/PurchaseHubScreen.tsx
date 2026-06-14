import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import ModuleHubScreen, { HubItem } from '../../components/common/ModuleHubScreen';
import type { PurchaseStackParamList } from '../../navigation/types';

type Props = StackScreenProps<PurchaseStackParamList, 'PurchaseHub'>;

const ITEMS: HubItem[] = [
  { title: 'Purchase Orders', route: 'PurchaseOrders' },
  { title: 'Purchase Bills', route: 'PurchaseBills' },
  { title: 'Vendor Payments', route: 'VendorPayments' },
  { title: 'Debit Notes', route: 'DebitNotes' },
  { title: 'Expenses', route: 'Expenses' },
  { title: 'Recurring Bills', route: 'RecurringBills' },
];

export default function PurchaseHubScreen({ navigation }: Props) {
  return <ModuleHubScreen title="Purchase" items={ITEMS} navigation={navigation} />;
}
