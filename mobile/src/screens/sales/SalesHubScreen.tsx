import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import ModuleHubScreen, { HubItem } from '../../components/common/ModuleHubScreen';
import type { SalesStackParamList } from '../../navigation/types';

type Props = StackScreenProps<SalesStackParamList, 'SalesHub'>;

const ITEMS: HubItem[] = [
  { title: 'Quotations', route: 'Quotations' },
  { title: 'Proforma', route: 'Proforma' },
  { title: 'Sales Orders', route: 'SalesOrders' },
  { title: 'Dispatch Notes', route: 'DispatchNotes' },
  { title: 'Tax Invoices', route: 'TaxInvoices' },
  { title: 'Collections', route: 'Collections' },
  { title: 'Credit Adjustments', route: 'CreditAdjustments' },
  { title: 'Recurring', route: 'RecurringSales' },
];

export default function SalesHubScreen({ navigation }: Props) {
  return <ModuleHubScreen title="Sales" items={ITEMS} navigation={navigation} />;
}
