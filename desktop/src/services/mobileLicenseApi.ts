// Client-side wrapper for the backend mobile/OTP/license APIs.
// Backend responsibilities:
// - Firestore access
// - OTP generation / verification
// - License activation and transfer limits
//
// All functions here assume the backend is reachable over HTTPS and that
// CORS / auth are configured on the server side.

export interface SendOtpResponse {
  success: boolean;
  message?: string;
  verificationId?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  token?: string; // temp token used for subsequent license actions
  message?: string;
  mobile?: string;
  expiresIn?: number;
}

export interface ActivateLicenseResponse {
  success: boolean;
  message?: string;
  // Optional: backend may return normalized mobile/license/machine info
  mobile?: string;
  licenseKey?: string;
}

export interface RequestTransferResponse {
  canTransfer: boolean;
  reason?: string | null;
  currentDevice?: {
    name?: string;
    activatedOn?: string;
  } | null;
}

export interface ConfirmTransferResponse {
  success: boolean;
  message?: string;
}

export interface VerifyLicenseResponse {
  valid: boolean;
  message?: string;
}

function getApiBaseUrl(): string {
  // Allow override via env; fallback to local API server
  const fromEnv = (import.meta as any).env?.VITE_LICENSE_API_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/+$/, '');
  }
  // Default to local API server
  return 'http://localhost:3001';
}

async function postJson<T>(path: string, body: any, opts?: { token?: string }): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts?.token) {
    headers['Authorization'] = `Bearer ${opts.token}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const msg = data?.message || data?.reason || res.statusText || 'Request failed';
    const err: any = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export async function sendOtp(mobile: string): Promise<SendOtpResponse> {
  return postJson<SendOtpResponse>('/api/auth/send-otp', { mobile });
}

export async function verifyOtp(verificationId: string, otp: string): Promise<VerifyOtpResponse> {
  return postJson<VerifyOtpResponse>('/api/auth/verify-otp', { verificationId, otp });
}

export async function activateLicenseWithMobile(params: {
  token: string;
  mobile: string;
  licenseKey: string;
  machineId: string;
  deviceInfo: { name?: string; model?: string; os?: string };
  // optional contact fields
  email?: string;
  customerName?: string;
  businessName?: string;
}): Promise<ActivateLicenseResponse> {
  return postJson<ActivateLicenseResponse>(
    '/api/license/activate',
    {
      mobile: params.mobile,
      licenseKey: params.licenseKey,
      machineID: params.machineId,
      deviceInfo: params.deviceInfo,
      email: params.email,
      customerName: params.customerName,
      businessName: params.businessName,
    },
    { token: params.token },
  );
}

export async function requestTransfer(body: {
  mobile: string;
  licenseKey: string;
  newMachineId: string;
}): Promise<RequestTransferResponse> {
  return postJson<RequestTransferResponse>('/api/license/request-transfer', body);
}

export async function confirmTransfer(body: {
  mobile: string;
  otp: string;
  licenseKey: string;
  newMachineId: string;
  deviceInfo: { name?: string; model?: string; os?: string };
}): Promise<ConfirmTransferResponse> {
  return postJson<ConfirmTransferResponse>('/api/license/confirm-transfer', body);
}

export async function verifyLicenseOnline(body: {
  licenseKey: string;
  machineId: string;
}): Promise<VerifyLicenseResponse> {
  return postJson<VerifyLicenseResponse>('/api/license/verify', body);
}

