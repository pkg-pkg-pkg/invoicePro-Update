import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import VoucherFormScreen from '../../components/forms/VoucherFormScreen';
import type { PurchaseStackParamList } from '../../navigation/types';

type Props = StackScreenProps<PurchaseStackParamList, 'PurchaseBillForm'>;

export default function PurchaseBillFormScreen({ navigation }: Props) {
  return (
    <VoucherFormScreen
      title="New Purchase Bill"
      voucherType="purchase_bill"
      partyLabel="Vendor"
      navigation={navigation}
    />
  );
}
