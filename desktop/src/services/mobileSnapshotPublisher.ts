/** Publishes dashboard KPI snapshot for mobile app (desktop must be running). */
export async function publishMobileDataSnapshot(snapshot: {
  todaySales?: number;
  todayReceipts?: number;
  outstanding?: number;
  stockValue?: number;
  companyName?: string;
  recentInvoices?: Array<{ id: string; number: string; customer: string; amount: number; date: string }>;
  topCustomers?: Array<{ name: string; amount: number }>;
}) {
  if (!window.electronAPI?.mobileSnapshotPublish) return;
  await window.electronAPI.mobileSnapshotPublish({
    ...snapshot,
    publishedAt: new Date().toISOString(),
  });
}
