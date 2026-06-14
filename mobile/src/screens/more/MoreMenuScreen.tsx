import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import ModuleHubScreen, { HubItem } from '../../components/common/ModuleHubScreen';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'MoreMenu'>;

const ITEMS: HubItem[] = [
  { title: 'Items / Inventory', route: 'ItemsHub', subtitle: 'Items, price lists, godowns' },
  { title: 'Banking', route: 'BankingHub', subtitle: 'Receipts, payments, ledgers' },
  { title: 'Customers', route: 'Customers', subtitle: 'Customer master & ledger' },
  { title: 'Reports', route: 'ReportsMenu', subtitle: 'Sales, stock, financial reports' },
  { title: 'GST Reports', route: 'GSTReports', subtitle: 'GSTR-1, 2, 3B, 9, HSN' },
  { title: 'Settings', route: 'Settings', subtitle: 'Sync, account, logout' },
];

export default function MoreMenuScreen({ navigation }: Props) {
  return <ModuleHubScreen title="More Modules" items={ITEMS} navigation={navigation} />;
}
