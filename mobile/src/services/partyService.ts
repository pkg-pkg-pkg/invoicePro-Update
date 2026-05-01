import api from './api';

export type PartyKind = 'CUSTOMER' | 'SUPPLIER';

export type PartyRecord = {
  id: string;
  name: string;
  phone?: string;
  kind: PartyKind;
};

type ListResponse<T> = {
  data: T[];
};

export async function listParties(search: string): Promise<PartyRecord[]> {
  const [customersRes, suppliersRes] = await Promise.all([
    api.get<ListResponse<{ id: string; name: string; phone?: string }>>('/customers', {
      params: { search, limit: 50, page: 1 },
    }),
    api.get<ListResponse<{ id: string; name: string; phone?: string }>>('/suppliers', {
      params: { search, limit: 50, page: 1 },
    }),
  ]);

  const customers = (customersRes.data?.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    kind: 'CUSTOMER' as const,
  }));
  const suppliers = (suppliersRes.data?.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    kind: 'SUPPLIER' as const,
  }));
  return [...customers, ...suppliers];
}

export async function createCustomer(input: {
  name: string;
  phone: string;
  city?: string;
  state?: string;
  addressLine1?: string;
}) {
  const response = await api.post('/customers', {
    name: input.name,
    phone: input.phone,
    city: input.city ?? '',
    state: input.state ?? '',
    addressLine1: input.addressLine1 ?? '',
  });
  return response.data;
}

export async function createSupplier(input: {
  name: string;
  phone: string;
  city?: string;
  state?: string;
  addressLine1?: string;
}) {
  const response = await api.post('/suppliers', {
    name: input.name,
    phone: input.phone,
    city: input.city ?? '',
    state: input.state ?? '',
    addressLine1: input.addressLine1 ?? '',
  });
  return response.data;
}

