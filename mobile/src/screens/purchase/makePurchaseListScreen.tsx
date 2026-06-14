import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import DocumentListScreen from '../../components/vouchers/DocumentListScreen';
import type { PurchaseStackParamList } from '../../navigation/types';
import { CACHE_KEYS } from '../../services/cache/offlineCache';

type Config = {
  name: keyof PurchaseStackParamList;
  title: string;
  voucherType: string;
  formRoute: keyof PurchaseStackParamList;
};

export function makePurchaseListScreen(config: Config) {
  return function PurchaseListScreen({ navigation }: StackScreenProps<PurchaseStackParamList, typeof config.name>) {
    return (
      <DocumentListScreen
        title={config.title}
        voucherType={config.voucherType}
        cacheKey={CACHE_KEYS.vouchersPurchase}
        formRoute={config.formRoute}
        navigation={navigation}
      />
    );
  };
}
