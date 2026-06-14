import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import DocumentListScreen from '../../components/vouchers/DocumentListScreen';
import { CACHE_KEYS } from '../../services/cache/offlineCache';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'PaymentVouchers'>;

export default function PaymentVouchersScreen({ navigation }: Props) {
  return (
    <DocumentListScreen
      title="Payment Vouchers"
      voucherType="payment"
      cacheKey={CACHE_KEYS.vouchersPayment}
      formRoute="PaymentReceiptDesk"
      navigation={navigation}
    />
  );
}
