import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import VoucherFormScreen from '../../components/forms/VoucherFormScreen';
import type { SalesStackParamList } from '../../navigation/types';

type Props = StackScreenProps<SalesStackParamList, 'TaxInvoiceForm'>;

export default function TaxInvoiceFormScreen({ navigation }: Props) {
  return (
    <VoucherFormScreen
      title="New Tax Invoice"
      voucherType="sales_invoice"
      partyLabel="Customer"
      navigation={navigation}
    />
  );
}
