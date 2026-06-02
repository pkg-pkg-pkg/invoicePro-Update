/** Next GSTR-1 / 3B filing due (11th of following month — simplified). */
export function nextGstFilingDueLabel(now = new Date()): string {
  const due = new Date(now.getFullYear(), now.getMonth() + 1, 11);
  return due.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function gstFilingReminderText(gstConfigured: boolean, now = new Date()): string {
  const due = nextGstFilingDueLabel(now);
  if (!gstConfigured) {
    return `GST not configured — configure GSTIN before filing (due ${due})`;
  }
  return `GST filing reminder: GSTR-1 / 3B due by ${due}`;
}
