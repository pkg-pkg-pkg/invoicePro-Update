import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import ModuleHubScreen, { HubItem } from '../../components/common/ModuleHubScreen';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'ItemsHub'>;

const ITEMS: HubItem[] = [
  { title: 'Items List', route: 'ItemsList' },
  { title: 'Price Lists', route: 'PriceLists' },
  { title: 'Inventory Adjustments', route: 'InventoryAdjustments' },
  { title: 'Godown Master', route: 'GodownMaster' },
];

export default function ItemsHubScreen({ navigation }: Props) {
  return <ModuleHubScreen title="Items / Inventory" items={ITEMS} navigation={navigation} />;
}
