import React from 'react';
import type { StackScreenProps } from '@react-navigation/stack';
import ModuleHubScreen, { HubItem } from '../../components/common/ModuleHubScreen';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'GSTReports'>;

const ITEMS: HubItem[] = [
  { title: 'GSTR-1 (Sales Return)', route: 'GSTR1', subtitle: 'B2B, B2C, HSN Summary' },
  { title: 'GSTR-2 (Purchase Return)', route: 'GSTR2', subtitle: 'Bills, ITC, HSN' },
  { title: 'GSTR-3B (Monthly Return)', route: 'GSTR3B', subtitle: 'Outward, Inward, Tax' },
  { title: 'GSTR-9 (Annual Return)', route: 'GSTR9', subtitle: 'Annual, Monthly Reconciliation' },
  { title: 'HSN Summary', route: 'HSNSummary', subtitle: 'HSN-wise, Tax Calculation' },
];

export default function GSTReportsScreen({ navigation }: Props) {
  return <ModuleHubScreen title="GST Reports" items={ITEMS} navigation={navigation} />;
}
