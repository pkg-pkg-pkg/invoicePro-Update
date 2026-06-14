import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import DocumentListScreen from '../../components/vouchers/DocumentListScreen';
import { CACHE_KEYS } from '../../services/cache/offlineCache';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'ReceiptVouchers'>;

export default function ReceiptVouchersScreen({ navigation }: Props) {
  return (
    <DocumentListScreen
      title="Receipt Vouchers"
      voucherType="receipt"
      cacheKey={CACHE_KEYS.vouchersReceipt}
      formRoute="PaymentReceiptDesk"
      navigation={navigation}
    />
  );
}
