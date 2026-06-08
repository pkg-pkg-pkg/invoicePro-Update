const crypto = require('crypto');

const PIN_SALT = 'pve_mobile_user_pin_v1';

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function normalizeMobile(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return String(raw || '').trim();
}

function deviceKey(deviceId) {
  return crypto.createHash('sha256').update(String(deviceId || ''), 'utf8').digest('hex').slice(0, 32);
}

function pinHash(pin) {
  return crypto
    .createHash('sha256')
    .update(`${PIN_SALT}:${String(pin || '').trim()}`, 'utf8')
    .digest('hex');
}

function mobileUserDocId(licenseKey, userEmail) {
  const lic = String(licenseKey || '').trim().toUpperCase();
  const em = normalizeEmail(userEmail);
  return `${lic}__${em}`;
}

function parseEntitlements(raw) {
  if (!raw || typeof raw !== 'object') return { users: [], syncedAt: null };
  const users = Array.isArray(raw.users) ? raw.users : [];
  return {
    users: users.map((u) => ({
      id: String(u.id || ''),
      licenseKey: String(u.licenseKey || '').toUpperCase(),
      userEmail: normalizeEmail(u.userEmail),
      mobileNumber: normalizeMobile(u.mobileNumber),
      displayName: String(u.displayName || u.userEmail || ''),
      status: String(u.status || 'active'),
      validUntilMs: u.validUntilMs != null ? Number(u.validUntilMs) : null,
      deviceId: u.deviceId ? String(u.deviceId) : null,
      deviceKey: u.deviceKey ? String(u.deviceKey) : null,
      pinHash: String(u.pinHash || ''),
    })),
    syncedAt: raw.syncedAt || null,
  };
}

function findUser(entitlements, loginId) {
  const login = String(loginId || '').trim().toLowerCase();
  const loginMobile = normalizeMobile(loginId);
  return entitlements.users.find((u) => {
    if (u.status !== 'active') return false;
    if (normalizeEmail(u.userEmail) === login) return true;
    if (normalizeMobile(u.mobileNumber) === loginMobile) return true;
    return false;
  });
}

function isSubscriptionActive(user, nowMs = Date.now()) {
  if (!user || user.status !== 'active') return false;
  if (user.validUntilMs != null && user.validUntilMs < nowMs) return false;
  return true;
}

function validateMobileLogin(entitlements, { loginId, pin, deviceId }) {
  const user = findUser(entitlements, loginId);
  if (!user) {
    return { ok: false, error: 'Mobile user not found or not activated. Ask your admin to approve subscription.' };
  }
  if (!isSubscriptionActive(user)) {
    return { ok: false, error: 'Mobile subscription expired. Renew from desktop Store (₹599/year).' };
  }
  if (!pin || pinHash(pin) !== user.pinHash) {
    return { ok: false, error: 'Invalid PIN. Use the PIN shared after admin approval.' };
  }

  const dKey = deviceKey(deviceId);
  if (user.deviceId && user.deviceKey && user.deviceKey !== dKey) {
    return {
      ok: false,
      error: 'This account is bound to another phone. Request device transfer from desktop Store or admin.',
      code: 'device_mismatch',
    };
  }

  const needsDeviceBind = !user.deviceId;
  return {
    ok: true,
    user: {
      id: user.id,
      email: user.userEmail,
      mobile: user.mobileNumber,
      displayName: user.displayName,
      validUntilMs: user.validUntilMs,
      licenseKey: user.licenseKey,
    },
    needsDeviceBind,
    deviceKey: dKey,
  };
}

function bindDeviceInEntitlements(entitlements, userId, deviceId) {
  const dKey = deviceKey(deviceId);
  const users = entitlements.users.map((u) =>
    u.id === userId
      ? {
          ...u,
          deviceId: String(deviceId),
          deviceKey: dKey,
        }
      : u
  );
  return { ...entitlements, users, syncedAt: new Date().toISOString() };
}

function createSessionToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = {
  normalizeEmail,
  normalizeMobile,
  deviceKey,
  pinHash,
  mobileUserDocId,
  parseEntitlements,
  findUser,
  isSubscriptionActive,
  validateMobileLogin,
  bindDeviceInEntitlements,
  createSessionToken,
};
