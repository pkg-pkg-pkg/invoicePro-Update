import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import DocumentListScreen from '../../components/vouchers/DocumentListScreen';
import type { SalesStackParamList } from '../../navigation/types';
import { CACHE_KEYS } from '../../services/cache/offlineCache';

type Config = {
  name: keyof SalesStackParamList;
  title: string;
  voucherType: string;
  formRoute: keyof SalesStackParamList;
};

export function makeSalesListScreen(config: Config) {
  return function SalesListScreen({ navigation }: StackScreenProps<SalesStackParamList, typeof config.name>) {
    return (
      <DocumentListScreen
        title={config.title}
        voucherType={config.voucherType}
        cacheKey={CACHE_KEYS.vouchersSales}
        formRoute={config.formRoute}
        navigation={navigation}
      />
    );
  };
}
