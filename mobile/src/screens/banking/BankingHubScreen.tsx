import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import ModuleHubScreen, { HubItem } from '../../components/common/ModuleHubScreen';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'BankingHub'>;

const ITEMS: HubItem[] = [
  { title: 'Bank & Cash Accounts', route: 'BankAccounts' },
  { title: 'Ledger Accounts', route: 'LedgerAccounts' },
  { title: 'Receipt Vouchers', route: 'ReceiptVouchers' },
  { title: 'Payment Vouchers', route: 'PaymentVouchers' },
  { title: 'Payment & Receipt Desk', route: 'PaymentReceiptDesk' },
  { title: 'Journal Vouchers', route: 'JournalVouchers' },
];

export default function BankingHubScreen({ navigation }: Props) {
  return <ModuleHubScreen title="Banking" items={ITEMS} navigation={navigation} />;
}
