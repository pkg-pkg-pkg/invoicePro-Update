export type DetectedLocation = {
  ip_address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  latitude: number;
  longitude: number;
  isp: string;
};

const EMPTY: DetectedLocation = {
  ip_address: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  latitude: 0,
  longitude: 0,
  isp: '',
};

export async function detectLocation(): Promise<DetectedLocation> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) return { ...EMPTY };
    const data = (await res.json()) as Record<string, unknown>;
    return {
      ip_address: String(data.ip ?? ''),
      city: String(data.city ?? ''),
      state: String(data.region ?? ''),
      country: String(data.country_name ?? 'India'),
      pincode: String(data.postal ?? ''),
      latitude: Number(data.latitude ?? 0),
      longitude: Number(data.longitude ?? 0),
      isp: String(data.org ?? ''),
    };
  } catch {
    return { ...EMPTY };
  }
}
