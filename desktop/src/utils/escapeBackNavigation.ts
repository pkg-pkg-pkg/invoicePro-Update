/**
 * When browser / React Router cannot go back (history idx 0, many `replace` navigations),
 * Escape should still jump to a sensible parent — not always Dashboard.
 */
export type EscapeBackAction =
  | { type: 'history' }
  | { type: 'navigate'; to: string }
  | { type: 'quit' };

function normalizeRoute(pathname: string, search: string): string {
  const path = (pathname.startsWith('/') ? pathname : `/${pathname}`).replace(/\/+$/, '') || '/';
  const rawSearch = search.startsWith('?') ? search : search ? `?${search}` : '';
  return `${path}${rawSearch}`;
}

function routesEqual(a: string, b: string): boolean {
  const parse = (raw: string) => {
    const q = raw.indexOf('?');
    const path = (q >= 0 ? raw.slice(0, q) : raw).replace(/\/+$/, '') || '/';
    const search = q >= 0 ? raw.slice(q) : '';
    return `${path}${search}`;
  };
  return parse(a) === parse(b);
}

export function resolveEscapeBackAction(
  pathname: string,
  search: string,
  historyCanGoBack: boolean
): EscapeBackAction {
  if (historyCanGoBack) return { type: 'history' };

  const semantic = getSemanticEscapeTarget(pathname, search);
  if (semantic) {
    if (routesEqual(semantic, normalizeRoute(pathname, search))) {
      return { type: 'quit' };
    }
    return { type: 'navigate', to: semantic };
  }

  const currentPath = normalizeRoute(pathname, search).split('?')[0] ?? '/';
  if (currentPath === '/dashboard') {
    return { type: 'quit' };
  }
  return { type: 'navigate', to: '/dashboard' };
}

export function getSemanticEscapeTarget(pathname: string, search: string): string | null {
  const path = (pathname.startsWith('/') ? pathname : `/${pathname}`).replace(/\/+$/, '') || '/';
  const qs = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(qs);
  const tab = (params.get('tab') || '').trim().toLowerCase();

  // --- Settings: stay inside Settings (desk hub → base Settings → then Dashboard).
  if (path === '/settings') {
    if (!tab) return '/dashboard';
    if (tab === 'companydesk' || tab === 'companyops') {
      return '/settings';
    }
    return '/settings?tab=companydesk';
  }

  // --- Schemes / Reports: first Esc clears query drill-down
  if (path === '/schemes' && qs) return '/schemes';
  if (path === '/reports' && qs) return '/reports';

  // --- …/new → parent folder
  const newMatch = path.match(/^(.+)\/new$/);
  if (newMatch) return newMatch[1];

  // --- …/:segment/edit → parent list
  const editSegMatch = path.match(/^(.+)\/[^/]+\/edit$/);
  if (editSegMatch) return editSegMatch[1];

  // --- Customer detail: /customers/:id → list
  const customerDetail = path.match(/^\/customers\/([^/]+)$/);
  if (customerDetail) {
    const seg = customerDetail[1];
    if (seg !== 'ledger-report') return '/customers';
  }

  // --- Party master form: /parties/:id (dynamic id only)
  const partyForm = path.match(/^\/parties\/([^/]+)$/);
  if (partyForm) {
    const seg = partyForm[1];
    if (seg !== 'new' && seg !== 'ledger-report' && !seg.startsWith('party-ledger')) {
      return '/customers';
    }
  }

  // --- GST drill-down
  if (path.startsWith('/gst/') && path !== '/gst') return '/gst';

  if (path === '/business-profile') return '/dashboard';
  if (path === '/connect-to-host') return '/dashboard';

  // Section list roots: Esc leaves module to Dashboard (Tally-style “exit”).
  const sectionRoots = new Set([
    '/dashboard',
    '/items',
    '/banking',
    '/sales',
    '/purchase',
    '/masters/inventory-items',
    '/masters/godowns',
    '/masters/ledger-accounts',
    '/masters/bank-accounts',
    '/parties',
    '/customers',
    '/vouchers',
    '/vouchers/money',
    '/vouchers/sales',
    '/vouchers/purchase',
    '/vouchers/sales-return',
    '/vouchers/purchase-return',
    '/vouchers/payment-vouchers',
    '/vouchers/receipt-vouchers',
    '/vouchers/journal',
    '/reports',
    '/gst',
    '/schemes',
    '/payments',
    '/purchase-invoices',
    '/debit-notes',
    '/expenses',
    '/import/erp',
    '/approvals/pending',
  ]);
  if (sectionRoots.has(path)) return '/dashboard';

  return null;
}
