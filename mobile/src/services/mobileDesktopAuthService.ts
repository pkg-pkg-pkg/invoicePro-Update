// LEGACY: disabled — desktop-tethered auth replaced by invoicepro-api JWT auth.

export type DesktopLoginResult = {
  sessionToken: string;
  user: {
    id: string;
    email: string;
    mobile?: string;
    displayName?: string;
    validUntilMs?: number | null;
  };
};

export async function loginViaDesktopSync(_params: {
  loginId: string;
  pin: string;
}): Promise<DesktopLoginResult> {
  // LEGACY: disabled
  throw new Error('Desktop-tethered login is disabled. Use invoicepro-api login.');
  /*
  const config = await readSyncConfig();
  const endpoint = config.endpointBase.replace(/\/+$/, '');
  const deviceId = await getMobileDeviceId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.token.trim()) {
    headers.Authorization = `Bearer ${config.token.trim()}`;
    headers['X-Sync-Token'] = config.token.trim();
  }

  const response = await fetch(`${endpoint}/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      loginId: params.loginId.trim(),
      pin: params.pin.trim(),
      deviceId,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    throw new Error(String(payload?.error || 'Desktop login failed. Is desktop app running?'));
  }

  await writeSyncConfig({
    ...config,
    sessionToken: String(payload.sessionToken || ''),
    deviceId,
  });

  return {
    sessionToken: String(payload.sessionToken),
    user: payload.user,
  };
  */
}

export async function fetchDesktopSnapshot(): Promise<Record<string, unknown> | null> {
  // LEGACY: disabled
  return null;
  /*
  const config = await readSyncConfig();
  if (!config.sessionToken?.trim()) return null;
  const endpoint = config.endpointBase.replace(/\/+$/, '');
  const headers: Record<string, string> = {
    'X-Mobile-Session': config.sessionToken.trim(),
  };
  if (config.token.trim()) {
    headers.Authorization = `Bearer ${config.token.trim()}`;
    headers['X-Sync-Token'] = config.token.trim();
  }
  const response = await fetch(`${endpoint}/data/snapshot`, { headers });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.snapshot ?? null;
  */
}
