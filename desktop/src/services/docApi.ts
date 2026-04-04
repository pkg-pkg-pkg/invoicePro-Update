export interface DocUpsertRequest {
  id?: string;
  docNumber?: string;
  date?: string;
  partyName?: string;
  amount?: number;
  payload: any;
  createdAt?: string;
  createdById?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedById?: string;
  updatedByName?: string;
}

export interface DocRow {
  id: string;
  docType: string;
  docNumber?: string;
  date?: string;
  partyName?: string;
  amount?: number;
  payload: any;
  createdAt?: string;
  createdById?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedById?: string;
  updatedByName?: string;
}

const getNetworkConfig = (): any => {
  try {
    const raw = localStorage.getItem('network_config');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getHostBaseUrl = (): string | null => {
  const cfg = getNetworkConfig();
  if (!cfg?.enabled) return null;

  const port = Number(cfg?.port ?? 3000) || 3000;

  if (cfg?.isServer) {
    return `http://localhost:${port}`;
  }

  const raw = String(cfg?.serverUrl ?? '').trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
};

const ensureOk = async (res: Response) => {
  if (res.ok) return;
  const txt = await res.text().catch(() => '');
  throw new Error(`Request failed: ${res.status} ${txt}`);
};

export const docApi = {
  async listDocs(docType: string): Promise<DocRow[]> {
    const base = getHostBaseUrl();
    if (!base) throw new Error('Host not configured');
    const res = await fetch(`${base}/api/docs/${encodeURIComponent(docType)}`);
    await ensureOk(res);
    const data = await res.json();
    return Array.isArray(data) ? (data as DocRow[]) : [];
  },

  async getDoc(docType: string, id: string): Promise<DocRow | null> {
    const base = getHostBaseUrl();
    if (!base) throw new Error('Host not configured');

    try {
      const res = await fetch(`${base}/api/docs/${encodeURIComponent(docType)}/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      await ensureOk(res);
      return (await res.json()) as DocRow;
    } catch {
      const rows = await this.listDocs(docType);
      const found = rows.find((r) => String(r?.id) === String(id));
      return found ?? null;
    }
  },

  async listPayloads<T = any>(docType: string): Promise<T[]> {
    const rows = await this.listDocs(docType);
    return rows.map((r: any) => r?.payload).filter(Boolean) as T[];
  },

  async upsertDoc(docType: string, id: string, req: DocUpsertRequest): Promise<DocRow> {
    const base = getHostBaseUrl();
    if (!base) throw new Error('Host not configured');

    const res = await fetch(`${base}/api/docs/${encodeURIComponent(docType)}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req, id }),
    });

    if (res.status === 404) {
      const res2 = await fetch(`${base}/api/docs/${encodeURIComponent(docType)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, id }),
      });
      await ensureOk(res2);
      return (await res2.json()) as DocRow;
    }

    await ensureOk(res);
    return (await res.json()) as DocRow;
  },

  async deleteDoc(docType: string, id: string): Promise<void> {
    const base = getHostBaseUrl();
    if (!base) throw new Error('Host not configured');
    const res = await fetch(`${base}/api/docs/${encodeURIComponent(docType)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await ensureOk(res);
  },
};
