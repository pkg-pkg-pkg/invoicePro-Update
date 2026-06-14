import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import DocumentListScreen from '../../components/vouchers/DocumentListScreen';
import { CACHE_KEYS } from '../../services/cache/offlineCache';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'JournalVouchers'>;

export default function JournalVouchersScreen({ navigation }: Props) {
  return (
    <DocumentListScreen
      title="Journal Vouchers"
      voucherType="journal"
      cacheKey={CACHE_KEYS.vouchersJournal}
      formRoute="PaymentReceiptDesk"
      navigation={navigation}
    />
  );
}
