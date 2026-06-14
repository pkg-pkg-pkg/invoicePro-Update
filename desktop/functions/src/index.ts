/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as crypto from "crypto";
import { admin } from "./adminBootstrap";
import { functions, runWithWithAdmin } from "./functionsRuntime";
import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
type LicenseDoc = {
  licenseKey: string;
  version: 1 | 2;
  assignedToEmail?: string;
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  createdByUid: string;
  expiryDate?: admin.firestore.Timestamp | null;
  maxActivations: number; // 0 = unlimited
  /** When true, LAN multi-user / unlimited activations product is enabled (set after admin approves UTR). */
  multiUserLan?: boolean;
  activationsCount: number;
  devices?: Record<
    string,
    {
      activatedAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
      lastSeenAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
    }
  >;
  revoked?: boolean;
  revokedAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
  note?: string;
};

const KEY_PREFIX = "INV2";
const SIG_LEN = 10;
const BODY_BYTES = 16;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Multi-user LAN upgrade: base + 18% GST (matches in-app UPI QR). */
const MULTI_USER_UPGRADE_INR = 11800;
const MULTI_USER_UPI_PAYEE = "7549030630@okbizaxis";

/** Annual Gateway (updates + new features): ₹699 + 18% GST ≈ ₹824.82 — rounded for UPI. */
const GATEWAY_RENEWAL_INR = 825;
const GATEWAY_UPI_PAYEE = MULTI_USER_UPI_PAYEE;
const GATEWAY_PERIOD_MS = 365 * 24 * 60 * 60 * 1000;
/** User can submit renewal this many days before current Gateway expiry. */
const GATEWAY_RENEWAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type UpgradeRequestDoc = {
  licenseKey: string;
  email: string;
  uid: string;
  utr: string;
  amountInr: number;
  upiPayee: string;
  status: "pending" | "approved" | "rejected";
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  reviewedAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
  reviewedByUid?: string;
  rejectReason?: string;
};

type GatewayRenewalRequestDoc = {
  licenseKey: string;
  email: string;
  uid: string;
  utr: string;
  amountInr: number;
  upiPayee: string;
  status: "pending" | "approved" | "rejected";
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  reviewedAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
  reviewedByUid?: string;
  rejectReason?: string;
};

function deviceKey(deviceId: string): string {
  return crypto.createHash("sha256").update(String(deviceId ?? ""), "utf8").digest("hex").slice(0, 32);
}

function maskLicenseKey(k: string): string {
  const key = String(k ?? "").trim().toUpperCase();
  if (!key) return "";
  return key.length <= 8 ? key : `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function requireAuth(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }
}

function requireEmail(context: functions.https.CallableContext): string {
  const email = String(context.auth?.token?.email ?? "").trim().toLowerCase();
  if (!email) {
    throw new functions.https.HttpsError("failed-precondition", "Email missing in auth token");
  }
  return email;
}

async function requireAdmin(context: functions.https.CallableContext): Promise<void> {
  requireAuth(context);
  const uid = String(context.auth?.uid ?? "");

  // Check the single 'admins' collection for admin privileges
  const snapAdmins = await admin.firestore().doc(`admins/${uid}`).get();
  if (snapAdmins.exists) return;

  throw new functions.https.HttpsError("permission-denied", "Admin only");
}

function readLicenseRuntimeConfig(): { secret: string; ownerEmails: string[] } {
  let cfgSecret = "";
  let cfgOwners = "";
  try {
    const configModule = require("firebase-functions/v1/config") as {
      config: () => { license?: { secret?: string; owner_email?: string; owner_emails?: string } };
    };
    const cfg = configModule.config()?.license;
    cfgSecret = String(cfg?.secret ?? "").trim();
    cfgOwners = String(cfg?.owner_email ?? cfg?.owner_emails ?? "").trim();
  } catch (e) {
    logger.warn("functions.config unavailable — use LICENSE_SECRET / LICENSE_OWNER_EMAILS env", e);
  }

  const secret = String(process.env.LICENSE_SECRET ?? cfgSecret).trim();
  const ownerRaw = String(process.env.LICENSE_OWNER_EMAILS ?? process.env.LICENSE_OWNER_EMAIL ?? cfgOwners).trim();
  const ownerEmails = ownerRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return { secret, ownerEmails };
}

function getSecret(): string {
  const { secret } = readLicenseRuntimeConfig();
  if (!secret) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      'Missing license secret. Set LICENSE_SECRET (recommended) or run: firebase functions:config:set license.secret="YOUR_SECRET"'
    );
  }
  return secret;
}

function getOwnerEmails(): string[] {
  return readLicenseRuntimeConfig().ownerEmails;
}

export const becomeAdmin = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (_data: any, context: functions.https.CallableContext) => {
    requireAuth(context);
    const email = requireEmail(context);
    const owners = getOwnerEmails();
    if (!owners.length || !owners.includes(email)) {
      throw new functions.https.HttpsError("permission-denied", "Owner only");
    }

    const uid = String(context.auth?.uid ?? "");
    if (!uid) throw new functions.https.HttpsError("failed-precondition", "Missing uid");

    await admin.firestore().doc(`admins/${uid}`).set(
      {
        email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await writeAudit({ type: "admin_bootstrap", licenseKey: "", email, uid, ok: true });
    return { ok: true };
  });

function signBody(secret: string, body: string): string {
  const h = crypto.createHmac("sha256", secret).update(body, "utf8").digest();
  return base32Encode(h).slice(0, SIG_LEN);
}

function isSignedLicenseKey(licenseKey: string): boolean {
  const key = String(licenseKey ?? "").trim().toUpperCase();
  const re = new RegExp(`^${KEY_PREFIX}-([A-Z2-7]+)-([A-Z2-7]{${SIG_LEN}})$`);
  return re.test(key);
}

function verifySignedKeyOrThrow(secret: string, licenseKey: string): void {
  const key = String(licenseKey ?? "").trim().toUpperCase();
  const re = new RegExp(`^${KEY_PREFIX}-([A-Z2-7]+)-([A-Z2-7]{${SIG_LEN}})$`);
  const m = key.match(re);
  if (!m) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid license key format");
  }
  const body = m[1];
  const sig = m[2];
  const expected = signBody(secret, body);
  if (sig !== expected) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid license key checksum");
  }
}

async function writeAudit(event: {
  type: string;
  licenseKey: string;
  email?: string;
  uid?: string;
  deviceId?: string;
  ok: boolean;
  reason?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const uid = event.uid ? String(event.uid) : "";
    let email = event.email ? String(event.email).trim().toLowerCase() : "";
    if (!email && uid) {
      try {
        const u = await admin.auth().getUser(uid);
        email = String(u?.email ?? "").trim().toLowerCase();
      } catch {
        // ignore
      }
    }

    const userKey = (email || uid || "unknown").slice(0, 200);
    const createdAtMs = Date.now();
    const stableHash = crypto
      .createHash("sha1")
      .update(
        JSON.stringify({
          t: event.type,
          k: event.licenseKey,
          e: email,
          u: uid,
          d: event.deviceId ?? "",
          ok: event.ok,
          r: event.reason ?? "",
          m: event.meta ?? null,
          ts: createdAtMs,
        })
      )
      .digest("hex")
      .slice(0, 12);
    const eventId = `${createdAtMs}_${event.type}_${stableHash}`;

    await admin
      .firestore()
      .collection("license_audit")
      .doc(userKey)
      .collection("events")
      .doc(eventId)
      .set({
        ...event,
        uid: uid || undefined,
        email: email || undefined,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (e) {
    logger.warn("audit_write_failed", e);
  }
}

function serializeFirestoreValue(v: any): any {
  if (v == null) return v;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.toDate === "function") return v.toDate().toISOString();
  if (typeof v?.path === "string" && v?.constructor?.name === "DocumentReference") {
    return v.path;
  }
  if (typeof v?.latitude === "number" && typeof v?.longitude === "number") {
    return { latitude: v.latitude, longitude: v.longitude };
  }
  if (Array.isArray(v)) return v.map(serializeFirestoreValue);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) out[k] = serializeFirestoreValue((v as any)[k]);
    return out;
  }
  return v;
}

function sortByCreatedAtDesc<T extends { createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(b?.createdAt ?? 0) - Number(a?.createdAt ?? 0));
}

async function queryWithCreatedAtFallback(
  ordered: () => Promise<admin.firestore.QuerySnapshot>,
  unordered: () => Promise<admin.firestore.QuerySnapshot>,
  label: string
): Promise<admin.firestore.QuerySnapshot> {
  try {
    return await ordered();
  } catch (err: any) {
    logger.warn(`${label}_ordered_query_failed`, err);
    return unordered();
  }
}

export const generateLicense = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);

    const secret = getSecret();
    const maxActivations = Number(data?.maxActivations ?? 1);
    const validityDays = data?.validityDays == null ? null : Number(data.validityDays);
    const note = data?.note != null ? String(data.note).slice(0, 200) : undefined;

    if (!Number.isFinite(maxActivations) || maxActivations < 0 || maxActivations > 1000) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid maxActivations");
    }
    if (validityDays != null && (!Number.isFinite(validityDays) || validityDays < 1 || validityDays > 3650)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid validityDays");
    }

    const customRaw = data?.customKey != null ? String(data.customKey).trim().toUpperCase() : "";
    let licenseKey: string;
    let version: 1 | 2 = 2;

    if (customRaw) {
      const exists = await admin.firestore().doc(`licenses/${customRaw}`).get();
      if (exists.exists) {
        throw new functions.https.HttpsError("already-exists", "License key already exists");
      }

      if (isSignedLicenseKey(customRaw)) {
        verifySignedKeyOrThrow(secret, customRaw);
        licenseKey = customRaw;
        version = 2;
      } else if (new RegExp(`^${KEY_PREFIX}-([A-Z2-7]+)$`).test(customRaw)) {
        const body = customRaw.replace(new RegExp(`^${KEY_PREFIX}-`), "");
        const sig = signBody(secret, body);
        licenseKey = `${KEY_PREFIX}-${body}-${sig}`;
        version = 2;
      } else if (/^[A-Z][A-Z0-9_-]{3,63}$/.test(customRaw)) {
        licenseKey = customRaw;
        version = 1;
      } else {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Custom key must be INV2-… (signed), INV2-BODY (we add signature), or legacy e.g. INVPRO0001"
        );
      }
    } else {
      const body = base32Encode(crypto.randomBytes(BODY_BYTES));
      const sig = signBody(secret, body);
      licenseKey = `${KEY_PREFIX}-${body}-${sig}`;
      version = 2;
    }

    const expiryDate =
      validityDays == null
        ? null
        : admin.firestore.Timestamp.fromMillis(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    const doc: LicenseDoc = {
      licenseKey,
      version,
      assignedToEmail: "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByUid: String(context.auth?.uid ?? ""),
      expiryDate,
      maxActivations: maxActivations || 0,
      activationsCount: 0,
      devices: {},
      revoked: false,
      ...(note != null ? { note } : {}),
    };

    await admin.firestore().doc(`licenses/${licenseKey}`).set(doc, { merge: false });
    await writeAudit({
      type: "generate",
      licenseKey,
      uid: String(context.auth?.uid ?? ""),
      ok: true,
      meta: { maxActivations: doc.maxActivations, validityDays },
    });

    return { ok: true, licenseKey, expiryDate: expiryDate ? expiryDate.toMillis() : null };
  });

export const revokeLicense = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const licenseKey = String(data?.licenseKey ?? "").trim().toUpperCase();
    if (!licenseKey) throw new functions.https.HttpsError("invalid-argument", "licenseKey required");

    await admin.firestore().doc(`licenses/${licenseKey}`).set(
      {
        revoked: true,
        revokedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await writeAudit({
      type: "revoke",
      licenseKey,
      uid: String(context.auth?.uid ?? ""),
      ok: true,
    });

    return { ok: true };
  });

export const listLicenses = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const pageSize = Math.min(Math.max(Number(data?.pageSize ?? 50), 1), 200);
    let snap: admin.firestore.QuerySnapshot;
    try {
      snap = await admin
        .firestore()
        .collection("licenses")
        .orderBy("createdAt", "desc")
        .limit(pageSize)
        .get();
    } catch {
      snap = await admin.firestore().collection("licenses").limit(pageSize).get();
    }

    const items = snap.docs.map((d) => ({
      id: d.id,
      ...(serializeFirestoreValue(d.data()) as any),
    }));
    return { ok: true, items };
  });

export const activateLicense = runWithWithAdmin({ maxInstances: 20 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    const uid = String(context.auth?.uid ?? "");
    const tokenEmail = String((context.auth?.token as any)?.email ?? "");
    const deviceId = String(data?.deviceId ?? "").trim();
    const licenseKey = String(data?.licenseKey ?? "").trim().toUpperCase();
    const dKey = deviceKey(deviceId);
    logger.info("activateLicense:incoming", {
      hasAuth: Boolean(context.auth),
      uid,
      tokenEmailPresent: Boolean(tokenEmail),
      dKey,
      licenseKey: maskLicenseKey(licenseKey),
    });

    requireAuth(context);
    const email = requireEmail(context);
    logger.info("activateLicense:call", { uid, email, dKey, licenseKey: maskLicenseKey(licenseKey) });

    if (!deviceId || deviceId.length < 6 || deviceId.length > 128) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid deviceId");
    }
    if (!licenseKey) throw new functions.https.HttpsError("invalid-argument", "licenseKey required");

    const licRef = admin.firestore().doc(`licenses/${licenseKey}`);
    const userRef = admin.firestore().doc(`users/${email}`);
    const now = admin.firestore.FieldValue.serverTimestamp();

    try {
      const res = await admin.firestore().runTransaction(async (tx: admin.firestore.Transaction) => {
        const licSnap = await tx.get(licRef);
        if (!licSnap.exists) {
          throw new functions.https.HttpsError("not-found", "License not found");
        }
        const lic = licSnap.data() as any;

        const secret = getSecret();
        const isSigned = isSignedLicenseKey(licenseKey);
        const ver = Number(lic?.version ?? 1);
        if (ver >= 2 || isSigned) {
          verifySignedKeyOrThrow(secret, licenseKey);
        }
        if (lic?.revoked) {
          throw new functions.https.HttpsError("failed-precondition", "License revoked");
        }
        const expiryDate: admin.firestore.Timestamp | null = lic?.expiryDate ?? null;
        if (expiryDate && expiryDate.toMillis() < Date.now()) {
          throw new functions.https.HttpsError("failed-precondition", "License expired");
        }

        const assigned = String(lic?.assignedToEmail ?? "").trim().toLowerCase();
        if (assigned && assigned !== email) {
          throw new functions.https.HttpsError("permission-denied", "License assigned to another email");
        }

        const maxActivations = Number(lic?.maxActivations ?? 1);
        const devices: Record<string, any> = lic?.devices ?? {};
        const dKey = deviceKey(deviceId);
        const hasDevice = Boolean(devices?.[dKey] || devices?.[deviceId]);
        const activationsCount = Number(lic?.activationsCount ?? Object.keys(devices || {}).length);

        if (!hasDevice && maxActivations > 0 && activationsCount >= maxActivations) {
          throw new functions.https.HttpsError("failed-precondition", "Activation limit reached");
        }

        // Bind to email on first activation
        if (!assigned) {
          tx.update(licRef, { assignedToEmail: email });
        }

        const existingGw = lic?.gatewayValidUntil as admin.firestore.Timestamp | undefined;
        const newGwUntil = existingGw
          ? null
          : admin.firestore.Timestamp.fromMillis(Date.now() + GATEWAY_PERIOD_MS);

        const licUpdate: Record<string, unknown> = {
          isActive: true,
          lastSeenAt: now,
          activationsCount: hasDevice ? activationsCount : activationsCount + 1,
          devices: {
            [dKey]: hasDevice ? { lastSeenAt: now } : { activatedAt: now, lastSeenAt: now },
          },
        };
        if (newGwUntil) {
          licUpdate.gatewayValidUntil = newGwUntil;
        }
        tx.set(licRef, licUpdate, { merge: true });

        const effectiveGw = existingGw ?? newGwUntil;
        if (newGwUntil) {
          const gwMetaRef = admin.firestore().doc(`licenses/${licenseKey}/Gateway/meta`);
          tx.set(
            gwMetaRef,
            {
              gatewayValidUntil: newGwUntil,
              updatedAt: now,
            },
            { merge: true }
          );
        }

        // Ensure user profile exists by email doc id
        tx.set(
          userRef,
          {
            email,
            licenseKey,
            lastLogin: now,
            lastActiveAt: now,
          },
          { merge: true }
        );

        return {
          licenseKey,
          assignedToEmail: email,
          expiryDateMs: expiryDate ? expiryDate.toMillis() : null,
          maxActivations: maxActivations || 0,
          activationsCount: hasDevice ? activationsCount : activationsCount + 1,
          multiUserLan: Boolean(lic?.multiUserLan),
          gatewayValidUntilMs: effectiveGw ? effectiveGw.toMillis() : null,
          gatewayUpdatesEntitled: effectiveGw ? effectiveGw.toMillis() > Date.now() : true,
        };
      });

      await writeAudit({ type: "activate", licenseKey, email, uid, deviceId, ok: true });
      return { ok: true, ...res };
    } catch (e: any) {
      logger.error("activateLicense:error", {
        uid,
        email,
        dKey,
        licenseKey: maskLicenseKey(licenseKey),
        code: String(e?.code ?? ""),
        message: String(e?.message ?? ""),
      });
      await writeAudit({
        type: "activate",
        licenseKey,
        email,
        uid,
        deviceId,
        ok: false,
        reason: String(e?.message ?? "activation_failed"),
      });
      throw e;
    }
  });

export const validateLicense = runWithWithAdmin({ maxInstances: 20 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    const uid = String(context.auth?.uid ?? "");
    const tokenEmail = String((context.auth?.token as any)?.email ?? "");
    const deviceId = String(data?.deviceId ?? "").trim();
    const licenseKey = String(data?.licenseKey ?? "").trim().toUpperCase();
    const dKey = deviceKey(deviceId);
    logger.info("validateLicense:incoming", {
      hasAuth: Boolean(context.auth),
      uid,
      tokenEmailPresent: Boolean(tokenEmail),
      dKey,
      licenseKey: maskLicenseKey(licenseKey),
    });

    requireAuth(context);
    const email = requireEmail(context);
    logger.info("validateLicense:call", { uid, email, dKey, licenseKey: maskLicenseKey(licenseKey) });

    try {
      if (!deviceId) throw new functions.https.HttpsError("invalid-argument", "deviceId required");
      if (!licenseKey) throw new functions.https.HttpsError("invalid-argument", "licenseKey required");

      const licRef = admin.firestore().doc(`licenses/${licenseKey}`);
      const userRef = admin.firestore().doc(`users/${email}`);
      const licSnap = await licRef.get();
      if (!licSnap.exists) throw new functions.https.HttpsError("not-found", "License not found");
      const lic = licSnap.data() as any;

      const secret = getSecret();
      const isSigned = isSignedLicenseKey(licenseKey);
      const ver = Number(lic?.version ?? 1);
      if (ver >= 2 || isSigned) {
        verifySignedKeyOrThrow(secret, licenseKey);
      }

      if (lic?.revoked) throw new functions.https.HttpsError("failed-precondition", "License revoked");
      const expiryDate: admin.firestore.Timestamp | null = lic?.expiryDate ?? null;
      if (expiryDate && expiryDate.toMillis() < Date.now()) {
        throw new functions.https.HttpsError("failed-precondition", "License expired");
      }
      const assigned = String(lic?.assignedToEmail ?? "").trim().toLowerCase();
      if (assigned && assigned !== email) {
        throw new functions.https.HttpsError("permission-denied", "License assigned to another email");
      }

      const devices: Record<string, any> = lic?.devices ?? {};
      const hasDevice = Boolean(devices?.[dKey] || devices?.[deviceId]);
      if (!hasDevice) {
        throw new functions.https.HttpsError("failed-precondition", "Device not activated");
      }

      await licRef.set(
        {
          isActive: true,
          lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
          devices: {
            [dKey]: {
              lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
        },
        { merge: true }
      );

      await userRef.set(
        {
          email,
          licenseKey,
          lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      let gwTs = lic?.gatewayValidUntil as admin.firestore.Timestamp | undefined;
      if (!gwTs) {
        gwTs = admin.firestore.Timestamp.fromMillis(Date.now() + GATEWAY_PERIOD_MS);
        await licRef.set({ gatewayValidUntil: gwTs }, { merge: true });
        await admin
          .firestore()
          .doc(`licenses/${licenseKey}/Gateway/meta`)
          .set(
            {
              gatewayValidUntil: gwTs,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }
      const gatewayValidUntilMs = gwTs.toMillis();
      const gatewayUpdatesEntitled = gatewayValidUntilMs > Date.now();

      return {
        ok: true,
        licenseKey,
        assignedToEmail: assigned || email,
        expiryDateMs: expiryDate ? expiryDate.toMillis() : null,
        maxActivations: Number(lic?.maxActivations ?? 0),
        activationsCount: Number(lic?.activationsCount ?? Object.keys(devices || {}).length),
        multiUserLan: Boolean(lic?.multiUserLan),
        gatewayValidUntilMs,
        gatewayUpdatesEntitled,
      };
    } catch (e: any) {
      logger.error("validateLicense:error", {
        uid,
        email,
        dKey,
        licenseKey: maskLicenseKey(licenseKey),
        code: String(e?.code ?? ""),
        message: String(e?.message ?? ""),
      });
      throw e;
    }
  });

export const transferLicense = runWithWithAdmin({ maxInstances: 20 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    requireAuth(context);
    const email = requireEmail(context);
    const uid = String(context.auth?.uid ?? "");
    const deviceId = String(data?.deviceId ?? "").trim();
    const licenseKey = String(data?.licenseKey ?? "").trim().toUpperCase();

    if (!deviceId || deviceId.length < 6 || deviceId.length > 128) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid deviceId");
    }
    if (!licenseKey) throw new functions.https.HttpsError("invalid-argument", "licenseKey required");

    const licRef = admin.firestore().doc(`licenses/${licenseKey}`);
    const userRef = admin.firestore().doc(`users/${email}`);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const dKey = deviceKey(deviceId);
    logger.info("transferLicense:call", { uid, email, dKey, licenseKey: maskLicenseKey(licenseKey) });

    try {
      const res = await admin.firestore().runTransaction(async (tx: admin.firestore.Transaction) => {
        const licSnap = await tx.get(licRef);
        if (!licSnap.exists) {
          throw new functions.https.HttpsError("not-found", "License not found");
        }
        const lic = licSnap.data() as any;

        const secret = getSecret();
        const isSigned = isSignedLicenseKey(licenseKey);
        const ver = Number(lic?.version ?? 1);
        if (ver >= 2 || isSigned) {
          verifySignedKeyOrThrow(secret, licenseKey);
        }
        if (lic?.revoked) {
          throw new functions.https.HttpsError("failed-precondition", "License revoked");
        }
        const expiryDate: admin.firestore.Timestamp | null = lic?.expiryDate ?? null;
        if (expiryDate && expiryDate.toMillis() < Date.now()) {
          throw new functions.https.HttpsError("failed-precondition", "License expired");
        }

        const assigned = String(lic?.assignedToEmail ?? "").trim().toLowerCase();
        if (assigned && assigned !== email) {
          throw new functions.https.HttpsError("permission-denied", "License assigned to another email");
        }

        const lastTransferAt: admin.firestore.Timestamp | null = lic?.lastTransferAt ?? null;
        if (lastTransferAt && lastTransferAt.toMillis() > Date.now() - 24 * 60 * 60 * 1000) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Transfer recently performed. Please try again later."
          );
        }

        if (!assigned) {
          tx.update(licRef, { assignedToEmail: email });
        }

        tx.set(
          licRef,
          {
            isActive: true,
            lastSeenAt: now,
            activationsCount: 1,
            devices: {
              [dKey]: {
                activatedAt: now,
                lastSeenAt: now,
              },
            },
            lastTransferAt: now,
          },
          { merge: true }
        );

        tx.set(
          userRef,
          {
            email,
            licenseKey,
            lastLogin: now,
            lastActiveAt: now,
          },
          { merge: true }
        );

        return {
          licenseKey,
          assignedToEmail: email,
          expiryDateMs: expiryDate ? expiryDate.toMillis() : null,
          maxActivations: Number(lic?.maxActivations ?? 0),
          activationsCount: 1,
        };
      });

      await writeAudit({ type: "transfer", licenseKey, email, uid, deviceId, ok: true });
      return { ok: true, ...res };
    } catch (e: any) {
      logger.error("transferLicense:error", {
        uid,
        email,
        dKey,
        licenseKey: maskLicenseKey(licenseKey),
        code: String(e?.code ?? ""),
        message: String(e?.message ?? ""),
      });
      await writeAudit({
        type: "transfer",
        licenseKey,
        email,
        uid,
        deviceId,
        ok: false,
        reason: String(e?.message ?? "transfer_failed"),
      });
      throw e;
    }
  });

export const surrenderLicense = runWithWithAdmin({ maxInstances: 20 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    requireAuth(context);
    const email = requireEmail(context);
    const uid = String(context.auth?.uid ?? "");
    const deviceId = String(data?.deviceId ?? "").trim();
    const licenseKey = String(data?.licenseKey ?? "").trim().toUpperCase();

    if (!licenseKey) throw new functions.https.HttpsError("invalid-argument", "licenseKey required");

    const licRef = admin.firestore().doc(`licenses/${licenseKey}`);
    const now = admin.firestore.FieldValue.serverTimestamp();

    try {
      await admin.firestore().runTransaction(async (tx: admin.firestore.Transaction) => {
        const licSnap = await tx.get(licRef);
        if (!licSnap.exists) {
          throw new functions.https.HttpsError("not-found", "License not found");
        }
        const lic = licSnap.data() as any;

        const secret = getSecret();
        const isSigned = isSignedLicenseKey(licenseKey);
        const ver = Number(lic?.version ?? 1);
        if (ver >= 2 || isSigned) {
          verifySignedKeyOrThrow(secret, licenseKey);
        }
        const assigned = String(lic?.assignedToEmail ?? "").trim().toLowerCase();
        if (assigned && assigned !== email) {
          throw new functions.https.HttpsError("permission-denied", "License assigned to another email");
        }

        tx.set(
          licRef,
          {
            isActive: false,
            activationsCount: 0,
            devices: {},
            surrenderedAt: now,
            lastSeenAt: now,
          },
          { merge: true }
        );
      });

      await writeAudit({ type: "surrender", licenseKey, email, uid, deviceId, ok: true });
      return { ok: true };
    } catch (e: any) {
      await writeAudit({
        type: "surrender",
        licenseKey,
        email,
        uid,
        deviceId,
        ok: false,
        reason: String(e?.message ?? "surrender_failed"),
      });
      throw e;
    }
  });

/**
 * Verify activation key for login - works with any license doc structure.
 * Tries doc ID first, then queries by licenseKey field (handles legacy keys like INVPRO0001).
 */
export const verifyActivationForLogin = runWithWithAdmin({ maxInstances: 20 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    requireAuth(context);
    const email = requireEmail(context);
    const licenseKey = String(data?.licenseKey ?? "").trim().toUpperCase();
    if (!licenseKey) {
      throw new functions.https.HttpsError("invalid-argument", "License key required");
    }

    let lic: any = null;
    let docId: string | null = null;

    const licRefById = admin.firestore().doc(`licenses/${licenseKey}`);
    const snapById = await licRefById.get();
    if (snapById.exists) {
      lic = snapById.data();
      docId = licenseKey;
    }

    if (!lic) {
      const q = await admin
        .firestore()
        .collection("licenses")
        .where("licenseKey", "==", licenseKey)
        .limit(1)
        .get();
      if (!q.empty) {
        const doc = q.docs[0];
        lic = doc.data();
        docId = doc.id;
      }
    }

    if (!lic || !docId) {
      throw new functions.https.HttpsError("not-found", "License not found");
    }

    if (lic.revoked) {
      throw new functions.https.HttpsError("failed-precondition", "License revoked");
    }

    const assigned = String(lic.assignedToEmail ?? "").trim().toLowerCase();
    if (assigned && assigned !== email) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "License is assigned to another email"
      );
    }

    const isActive = Boolean(lic.isActive);
    if (!isActive) {
      throw new functions.https.HttpsError("failed-precondition", "License is not active");
    }

    const expiry = lic.expiryDate;
    if (expiry) {
      const ms = expiry.toMillis ? expiry.toMillis() : new Date(expiry).getTime();
      if (ms < Date.now()) {
        throw new functions.https.HttpsError("failed-precondition", "License expired");
      }
    }

    return {
      ok: true,
      licenseKey: docId,
      assignedToEmail: assigned || email,
      expiryDateMs: expiry ? (expiry.toMillis ? expiry.toMillis() : new Date(expiry).getTime()) : null,
    };
  });

export const listAuditEvents = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    try {
      await requireAdmin(context);
      const limitN = Math.min(Math.max(Number(data?.limit ?? 100), 1), 500);
      const snap = await queryWithCreatedAtFallback(
        () =>
          admin
            .firestore()
            .collectionGroup("events")
            .orderBy("createdAt", "desc")
            .limit(limitN)
            .get(),
        () => admin.firestore().collectionGroup("events").limit(limitN * 3).get(),
        "listAuditEvents"
      );
      const items = snap.docs.map((d) => {
        const raw = d.data() as any;
        return {
          id: d.id,
          ...serializeFirestoreValue(raw),
        };
      });
      return { ok: true, items: sortByCreatedAtDesc(items).slice(0, limitN) };
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      logger.error("listAuditEvents_failed", err);
      return { ok: true, items: [] };
    }
  });

export const listUsers = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    try {
      await requireAdmin(context);
      const pageSize = Math.min(Math.max(Number(data?.pageSize ?? 200), 1), 500);
      const snap = await admin.firestore().collection("users").limit(pageSize).get();
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(serializeFirestoreValue(d.data()) as any),
      }));
      return { ok: true, items };
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      logger.error("listUsers_failed", err);
      return { ok: true, items: [] };
    }
  });

export const updateLicenseAdmin = runWithWithAdmin({ maxInstances: 10 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const licenseKey = String(data?.licenseKey ?? "").trim().toUpperCase();
    if (!licenseKey) throw new functions.https.HttpsError("invalid-argument", "licenseKey required");

    const licRef = admin.firestore().doc(`licenses/${licenseKey}`);
    const licSnap = await licRef.get();
    if (!licSnap.exists) throw new functions.https.HttpsError("not-found", "License not found");

    const updates: Record<string, unknown> = {};

    if (data.assignedToEmail !== undefined) {
      const em = String(data.assignedToEmail ?? "").trim().toLowerCase();
      updates.assignedToEmail = em;
    }

    if (data.maxActivations !== undefined) {
      const ma = Number(data.maxActivations);
      if (!Number.isFinite(ma) || ma < 0 || ma > 1000) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid maxActivations");
      }
      updates.maxActivations = ma;
    }

    if (data.note !== undefined) {
      updates.note = String(data.note ?? "").slice(0, 500);
    }

    if (data.validityDaysAbsolute !== undefined) {
      const vd = data.validityDaysAbsolute === null ? null : Number(data.validityDaysAbsolute);
      if (vd !== null && (!Number.isFinite(vd) || vd < 1 || vd > 3650)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid validityDaysAbsolute");
      }
      updates.expiryDate =
        vd === null ? null : admin.firestore.Timestamp.fromMillis(Date.now() + vd * 24 * 60 * 60 * 1000);
    }

    if (data.extendValidityDays !== undefined) {
      const days = Number(data.extendValidityDays);
      if (!Number.isFinite(days) || days < 1 || days > 3650) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid extendValidityDays");
      }
      const lic = licSnap.data() as any;
      const exp: admin.firestore.Timestamp | null = lic?.expiryDate ?? null;
      const expMs = exp ? exp.toMillis() : Date.now();
      const base = Math.max(expMs, Date.now());
      updates.expiryDate = admin.firestore.Timestamp.fromMillis(base + days * 24 * 60 * 60 * 1000);
    }

    if (data.clearExpiry === true) {
      updates.expiryDate = null;
    }

    if (data.revoked === true) {
      updates.revoked = true;
      updates.revokedAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (data.revoked === false) {
      updates.revoked = false;
      updates.revokedAt = admin.firestore.FieldValue.delete();
    }

    if (data.clearDevices === true) {
      updates.devices = {};
      updates.activationsCount = 0;
      updates.isActive = false;
    }

    if (data.multiUserLan !== undefined) {
      updates.multiUserLan = Boolean(data.multiUserLan);
    }

    if (Object.keys(updates).length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "No updates provided");
    }

    await licRef.set(updates, { merge: true });
    await writeAudit({
      type: "admin_update",
      licenseKey,
      uid: String(context.auth?.uid ?? ""),
      ok: true,
      meta: { fields: Object.keys(updates) },
    });

    return { ok: true };
  });

async function userLicenseKeyForEmail(email: string): Promise<string | null> {
  const snap = await admin.firestore().doc(`users/${email}`).get();
  if (!snap.exists) return null;
  const k = String((snap.data() as any)?.licenseKey ?? "").trim().toUpperCase();
  return k || null;
}

function normalizeUtr(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export const submitMultiUserUpgrade = runWithWithAdmin({ maxInstances: 10 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    requireAuth(context);
    const email = requireEmail(context);
    const uid = String(context.auth?.uid ?? "");
    const clientKey = String(data?.licenseKey ?? "").trim().toUpperCase();
    const utr = normalizeUtr(String(data?.utr ?? ""));

    if (!utr || utr.length < 8 || utr.length > 32) {
      throw new functions.https.HttpsError("invalid-argument", "Enter a valid UTR (8–32 characters)");
    }
    if (!/^[A-Z0-9]+$/.test(utr)) {
      throw new functions.https.HttpsError("invalid-argument", "UTR must be alphanumeric");
    }

    const profileKey = await userLicenseKeyForEmail(email);
    if (!profileKey) {
      throw new functions.https.HttpsError("failed-precondition", "No license on profile. Sign in with the licensed account.");
    }
    if (clientKey && clientKey !== profileKey) {
      throw new functions.https.HttpsError("permission-denied", "License key does not match your account");
    }
    const licenseKey = profileKey;

    const licRef = admin.firestore().doc(`licenses/${licenseKey}`);
    const licSnap = await licRef.get();
    if (!licSnap.exists) {
      throw new functions.https.HttpsError("not-found", "License not found");
    }
    const lic = licSnap.data() as any;
    if (lic?.revoked) {
      throw new functions.https.HttpsError("failed-precondition", "License revoked");
    }
    const assigned = String(lic?.assignedToEmail ?? "").trim().toLowerCase();
    if (assigned && assigned !== email) {
      throw new functions.https.HttpsError("permission-denied", "License belongs to another account");
    }

    if (Boolean(lic?.multiUserLan)) {
      throw new functions.https.HttpsError("failed-precondition", "Multi-user LAN is already active for this license");
    }

    const pendingSnap = await admin
      .firestore()
      .collection("license_upgrade_requests")
      .where("licenseKey", "==", licenseKey)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!pendingSnap.empty) {
      throw new functions.https.HttpsError("failed-precondition", "An upgrade request is already pending for this license");
    }

    const utrSnap = await admin
      .firestore()
      .collection("license_upgrade_requests")
      .where("utr", "==", utr)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!utrSnap.empty) {
      throw new functions.https.HttpsError("failed-precondition", "This UTR is already pending verification");
    }

    const doc: UpgradeRequestDoc = {
      licenseKey,
      email,
      uid,
      utr,
      amountInr: MULTI_USER_UPGRADE_INR,
      upiPayee: MULTI_USER_UPI_PAYEE,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await admin.firestore().collection("license_upgrade_requests").add(doc);

    await writeAudit({
      type: "multi_user_upgrade_submit",
      licenseKey,
      email,
      uid,
      ok: true,
      meta: { requestId: ref.id, utr },
    });

    return { ok: true, requestId: ref.id };
  });

export const getMyMultiUserUpgradeStatus = runWithWithAdmin({ maxInstances: 20 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    requireAuth(context);
    const email = requireEmail(context);
    const clientKey = String(data?.licenseKey ?? "").trim().toUpperCase();
    const profileKey = await userLicenseKeyForEmail(email);
    if (!profileKey) {
      return { ok: true, item: null as any, items: [] as any[] };
    }
    if (clientKey && clientKey !== profileKey) {
      throw new functions.https.HttpsError("permission-denied", "License key does not match your account");
    }
    const licenseKey = profileKey;

    const q = await admin
      .firestore()
      .collection("license_upgrade_requests")
      .where("licenseKey", "==", licenseKey)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    const items = q.docs.map((d) => ({
      id: d.id,
      ...(serializeFirestoreValue(d.data()) as any),
    }));
    const latest = items[0] ?? null;
    return { ok: true, item: latest, items };
  });

export const listMultiUserUpgradeRequests = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    try {
      await requireAdmin(context);
      const statusFilter = data?.status != null ? String(data.status) : "";
      const limitN = Math.min(Math.max(Number(data?.limit ?? 50), 1), 200);

      let snap: admin.firestore.QuerySnapshot;
      if (statusFilter === "pending" || statusFilter === "approved" || statusFilter === "rejected") {
        snap = await queryWithCreatedAtFallback(
          () =>
            admin
              .firestore()
              .collection("license_upgrade_requests")
              .where("status", "==", statusFilter)
              .orderBy("createdAt", "desc")
              .limit(limitN)
              .get(),
          () =>
            admin
              .firestore()
              .collection("license_upgrade_requests")
              .where("status", "==", statusFilter)
              .limit(limitN * 3)
              .get(),
          "listMultiUserUpgradeRequests"
        );
      } else {
        snap = await queryWithCreatedAtFallback(
          () =>
            admin
              .firestore()
              .collection("license_upgrade_requests")
              .orderBy("createdAt", "desc")
              .limit(limitN)
              .get(),
          () => admin.firestore().collection("license_upgrade_requests").limit(limitN * 3).get(),
          "listMultiUserUpgradeRequests"
        );
      }

      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(serializeFirestoreValue(d.data()) as any),
      }));
      return { ok: true, items: sortByCreatedAtDesc(items).slice(0, limitN) };
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      logger.error("listMultiUserUpgradeRequests_failed", err);
      return { ok: true, items: [] };
    }
  });

export const approveMultiUserUpgradeRequest = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const adminUid = String(context.auth?.uid ?? "");
    const requestId = String(data?.requestId ?? "").trim();
    if (!requestId) {
      throw new functions.https.HttpsError("invalid-argument", "requestId required");
    }

    const reqRef = admin.firestore().doc(`license_upgrade_requests/${requestId}`);

    let approvedLicenseKey = "";

    await admin.firestore().runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Request not found");
      }
      const req = reqSnap.data() as any;
      if (String(req?.status ?? "") !== "pending") {
        throw new functions.https.HttpsError("failed-precondition", "Request is not pending");
      }

      const licenseKey = String(req?.licenseKey ?? "").trim().toUpperCase();
      if (!licenseKey) {
        throw new functions.https.HttpsError("failed-precondition", "Request missing licenseKey");
      }
      approvedLicenseKey = licenseKey;

      const licRef = admin.firestore().doc(`licenses/${licenseKey}`);
      const licSnap = await tx.get(licRef);
      if (!licSnap.exists) {
        throw new functions.https.HttpsError("not-found", "License not found");
      }

      tx.set(
        licRef,
        {
          multiUserLan: true,
          maxActivations: 0,
          lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        reqRef,
        {
          status: "approved",
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
          reviewedByUid: adminUid,
        },
        { merge: true }
      );
    });

    await writeAudit({
      type: "multi_user_upgrade_approve",
      licenseKey: approvedLicenseKey,
      uid: adminUid,
      ok: true,
      meta: { requestId },
    });

    return { ok: true };
  });

export const rejectMultiUserUpgradeRequest = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const adminUid = String(context.auth?.uid ?? "");
    const requestId = String(data?.requestId ?? "").trim();
    const reason = String(data?.reason ?? "").trim().slice(0, 500);
    if (!requestId) {
      throw new functions.https.HttpsError("invalid-argument", "requestId required");
    }

    const reqRef = admin.firestore().doc(`license_upgrade_requests/${requestId}`);

    let licKey = "";

    await admin.firestore().runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Request not found");
      }
      const req = reqSnap.data() as any;
      if (String(req?.status ?? "") !== "pending") {
        throw new functions.https.HttpsError("failed-precondition", "Request is not pending");
      }
      licKey = String(req?.licenseKey ?? "").trim();

      tx.set(
        reqRef,
        {
          status: "rejected",
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
          reviewedByUid: adminUid,
          rejectReason: reason || undefined,
        },
        { merge: true }
      );
    });

    await writeAudit({
      type: "multi_user_upgrade_reject",
      licenseKey: licKey,
      uid: adminUid,
      ok: true,
      meta: { requestId, reason },
    });

    return { ok: true };
  });

export const submitGatewayRenewal = runWithWithAdmin({ maxInstances: 10 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    requireAuth(context);
    const email = requireEmail(context);
    const uid = String(context.auth?.uid ?? "");
    const clientKey = String(data?.licenseKey ?? "").trim().toUpperCase();
    const utr = normalizeUtr(String(data?.utr ?? ""));

    if (!utr || utr.length < 8 || utr.length > 32) {
      throw new functions.https.HttpsError("invalid-argument", "Enter a valid UTR (8–32 characters)");
    }
    if (!/^[A-Z0-9]+$/.test(utr)) {
      throw new functions.https.HttpsError("invalid-argument", "UTR must be alphanumeric");
    }

    const profileKey = await userLicenseKeyForEmail(email);
    if (!profileKey) {
      throw new functions.https.HttpsError("failed-precondition", "No license on profile.");
    }
    if (clientKey && clientKey !== profileKey) {
      throw new functions.https.HttpsError("permission-denied", "License key does not match your account");
    }
    const licenseKey = profileKey;

    const licRef = admin.firestore().doc(`licenses/${licenseKey}`);
    const licSnap = await licRef.get();
    if (!licSnap.exists) {
      throw new functions.https.HttpsError("not-found", "License not found");
    }
    const lic = licSnap.data() as any;
    if (lic?.revoked) {
      throw new functions.https.HttpsError("failed-precondition", "License revoked");
    }
    const assigned = String(lic?.assignedToEmail ?? "").trim().toLowerCase();
    if (assigned && assigned !== email) {
      throw new functions.https.HttpsError("permission-denied", "License belongs to another account");
    }

    const gwTs = lic?.gatewayValidUntil as admin.firestore.Timestamp | undefined;
    if (!gwTs) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Gateway not initialized yet — use the app online once after activation"
      );
    }
    const gwMs = gwTs.toMillis();
    if (gwMs > Date.now() + GATEWAY_RENEWAL_WINDOW_MS) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Annual renewal opens 30 days before your Gateway expiry date"
      );
    }

    const pendingSnap = await admin
      .firestore()
      .collection("gateway_renewal_requests")
      .where("licenseKey", "==", licenseKey)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!pendingSnap.empty) {
      throw new functions.https.HttpsError("failed-precondition", "A Gateway renewal is already pending for this license");
    }

    const utrSnap = await admin
      .firestore()
      .collection("gateway_renewal_requests")
      .where("utr", "==", utr)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!utrSnap.empty) {
      throw new functions.https.HttpsError("failed-precondition", "This UTR is already pending verification");
    }

    const doc: GatewayRenewalRequestDoc = {
      licenseKey,
      email,
      uid,
      utr,
      amountInr: GATEWAY_RENEWAL_INR,
      upiPayee: GATEWAY_UPI_PAYEE,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await admin.firestore().collection("gateway_renewal_requests").add(doc);

    await writeAudit({
      type: "gateway_renewal_submit",
      licenseKey,
      email,
      uid,
      ok: true,
      meta: { requestId: ref.id, utr },
    });

    return { ok: true, requestId: ref.id };
  });

export const getMyGatewayRenewalStatus = runWithWithAdmin({ maxInstances: 20 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    requireAuth(context);
    const email = requireEmail(context);
    const clientKey = String(data?.licenseKey ?? "").trim().toUpperCase();
    const profileKey = await userLicenseKeyForEmail(email);
    if (!profileKey) {
      return { ok: true, item: null as any, items: [] as any[] };
    }
    if (clientKey && clientKey !== profileKey) {
      throw new functions.https.HttpsError("permission-denied", "License key does not match your account");
    }
    const licenseKey = profileKey;

    const q = await admin
      .firestore()
      .collection("gateway_renewal_requests")
      .where("licenseKey", "==", licenseKey)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    const items = q.docs.map((d) => ({
      id: d.id,
      ...(serializeFirestoreValue(d.data()) as any),
    }));
    const latest = items[0] ?? null;
    return { ok: true, item: latest, items };
  });

export const listGatewayRenewalRequests = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    try {
      await requireAdmin(context);
      const statusFilter = data?.status != null ? String(data.status) : "";
      const limitN = Math.min(Math.max(Number(data?.limit ?? 50), 1), 200);

      let snap: admin.firestore.QuerySnapshot;
      if (statusFilter === "pending" || statusFilter === "approved" || statusFilter === "rejected") {
        snap = await queryWithCreatedAtFallback(
          () =>
            admin
              .firestore()
              .collection("gateway_renewal_requests")
              .where("status", "==", statusFilter)
              .orderBy("createdAt", "desc")
              .limit(limitN)
              .get(),
          () =>
            admin
              .firestore()
              .collection("gateway_renewal_requests")
              .where("status", "==", statusFilter)
              .limit(limitN * 3)
              .get(),
          "listGatewayRenewalRequests"
        );
      } else {
        snap = await queryWithCreatedAtFallback(
          () =>
            admin
              .firestore()
              .collection("gateway_renewal_requests")
              .orderBy("createdAt", "desc")
              .limit(limitN)
              .get(),
          () => admin.firestore().collection("gateway_renewal_requests").limit(limitN * 3).get(),
          "listGatewayRenewalRequests"
        );
      }

      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(serializeFirestoreValue(d.data()) as any),
      }));
      return { ok: true, items: sortByCreatedAtDesc(items).slice(0, limitN) };
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      logger.error("listGatewayRenewalRequests_failed", err);
      return { ok: true, items: [] };
    }
  });

export const approveGatewayRenewalRequest = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const adminUid = String(context.auth?.uid ?? "");
    const requestId = String(data?.requestId ?? "").trim();
    if (!requestId) {
      throw new functions.https.HttpsError("invalid-argument", "requestId required");
    }

    const reqRef = admin.firestore().doc(`gateway_renewal_requests/${requestId}`);
    let approvedLicenseKey = "";

    await admin.firestore().runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Request not found");
      }
      const req = reqSnap.data() as any;
      if (String(req?.status ?? "") !== "pending") {
        throw new functions.https.HttpsError("failed-precondition", "Request is not pending");
      }

      const licenseKey = String(req?.licenseKey ?? "").trim().toUpperCase();
      if (!licenseKey) {
        throw new functions.https.HttpsError("failed-precondition", "Request missing licenseKey");
      }
      approvedLicenseKey = licenseKey;

      const licRef = admin.firestore().doc(`licenses/${licenseKey}`);
      const licSnap = await tx.get(licRef);
      if (!licSnap.exists) {
        throw new functions.https.HttpsError("not-found", "License not found");
      }
      const lic = licSnap.data() as any;
      const curGw = lic?.gatewayValidUntil as admin.firestore.Timestamp | undefined;
      const baseMs = Math.max(Date.now(), curGw ? curGw.toMillis() : Date.now());
      const newUntil = admin.firestore.Timestamp.fromMillis(baseMs + GATEWAY_PERIOD_MS);
      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.set(
        licRef,
        {
          gatewayValidUntil: newUntil,
          lastSeenAt: now,
        },
        { merge: true }
      );

      const gwMetaRef = admin.firestore().doc(`licenses/${licenseKey}/Gateway/meta`);
      tx.set(
        gwMetaRef,
        {
          gatewayValidUntil: newUntil,
          updatedAt: now,
        },
        { merge: true }
      );

      tx.set(
        reqRef,
        {
          status: "approved",
          reviewedAt: now,
          reviewedByUid: adminUid,
        },
        { merge: true }
      );
    });

    await writeAudit({
      type: "gateway_renewal_approve",
      licenseKey: approvedLicenseKey,
      uid: adminUid,
      ok: true,
      meta: { requestId },
    });

    return { ok: true };
  });

export const rejectGatewayRenewalRequest = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const adminUid = String(context.auth?.uid ?? "");
    const requestId = String(data?.requestId ?? "").trim();
    const reason = String(data?.reason ?? "").trim().slice(0, 500);
    if (!requestId) {
      throw new functions.https.HttpsError("invalid-argument", "requestId required");
    }

    const reqRef = admin.firestore().doc(`gateway_renewal_requests/${requestId}`);
    let licKey = "";

    await admin.firestore().runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Request not found");
      }
      const req = reqSnap.data() as any;
      if (String(req?.status ?? "") !== "pending") {
        throw new functions.https.HttpsError("failed-precondition", "Request is not pending");
      }
      licKey = String(req?.licenseKey ?? "").trim();

      tx.set(
        reqRef,
        {
          status: "rejected",
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
          reviewedByUid: adminUid,
          rejectReason: reason || undefined,
        },
        { merge: true }
      );
    });

    await writeAudit({
      type: "gateway_renewal_reject",
      licenseKey: licKey,
      uid: adminUid,
      ok: true,
      meta: { requestId, reason },
    });

    return { ok: true };
  });

/** Mobile ERP user seat — ₹599/year; works while desktop is online (no cloud DB). */
const MOBILE_USER_ANNUAL_INR = 599;
const MOBILE_USER_PERIOD_MS = 365 * 24 * 60 * 60 * 1000;
const MOBILE_PIN_SALT = "pve_mobile_user_pin_v1";

type MobileUserRequestDoc = {
  licenseKey: string;
  ownerEmail: string;
  ownerUid: string;
  userEmail: string;
  mobileNumber: string;
  displayName?: string;
  utr: string;
  amountInr: number;
  upiPayee: string;
  status: "pending" | "approved" | "rejected";
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  reviewedAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
  reviewedByUid?: string;
  rejectReason?: string;
};

type MobileUserDoc = {
  licenseKey: string;
  ownerEmail: string;
  userEmail: string;
  mobileNumber: string;
  displayName: string;
  pinHash: string;
  status: "active" | "suspended";
  validFrom: admin.firestore.Timestamp | admin.firestore.FieldValue;
  validUntil: admin.firestore.Timestamp | admin.firestore.FieldValue;
  deviceId?: string | null;
  deviceKey?: string | null;
  deviceBoundAt?: admin.firestore.Timestamp | admin.firestore.FieldValue | null;
  transferPending?: boolean;
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  approvedAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
  approvedByUid?: string;
  lastRequestId?: string;
};

function normalizeMobileNumber(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return String(raw ?? "").trim();
}

function mobileUserId(licenseKey: string, userEmail: string): string {
  const lic = String(licenseKey ?? "").trim().toUpperCase();
  const em = String(userEmail ?? "").trim().toLowerCase();
  return `${lic}__${em}`;
}

function hashMobilePin(pin: string): string {
  return crypto
    .createHash("sha256")
    .update(`${MOBILE_PIN_SALT}:${String(pin ?? "").trim()}`, "utf8")
    .digest("hex");
}

function generateMobilePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const submitMobileUserSubscription = runWithWithAdmin({ maxInstances: 10 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    requireAuth(context);
    const ownerEmail = requireEmail(context);
    const ownerUid = String(context.auth?.uid ?? "");
    const clientKey = String(data?.licenseKey ?? "").trim().toUpperCase();
    const userEmail = String(data?.userEmail ?? "").trim().toLowerCase();
    const mobileNumber = normalizeMobileNumber(String(data?.mobileNumber ?? ""));
    const displayName = String(data?.displayName ?? "").trim().slice(0, 120);
    const utr = normalizeUtr(String(data?.utr ?? ""));

    if (!userEmail || !userEmail.includes("@")) {
      throw new functions.https.HttpsError("invalid-argument", "Valid employee email is required");
    }
    if (!mobileNumber || mobileNumber.replace(/\D/g, "").length < 10) {
      throw new functions.https.HttpsError("invalid-argument", "Valid mobile number is required");
    }
    if (!utr || utr.length < 8 || utr.length > 32) {
      throw new functions.https.HttpsError("invalid-argument", "Enter a valid UTR (8–32 characters)");
    }

    const profileKey = await userLicenseKeyForEmail(ownerEmail);
    if (!profileKey) {
      throw new functions.https.HttpsError("failed-precondition", "No license on profile.");
    }
    if (clientKey && clientKey !== profileKey) {
      throw new functions.https.HttpsError("permission-denied", "License key does not match your account");
    }
    const licenseKey = profileKey;

    const userRef = admin.firestore().doc(`mobile_users/${mobileUserId(licenseKey, userEmail)}`);
    const existingUser = await userRef.get();
    if (existingUser.exists) {
      const u = existingUser.data() as any;
      const until = u?.validUntil as admin.firestore.Timestamp | undefined;
      if (u?.status === "active" && until && until.toMillis() > Date.now()) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "This mobile user already has an active subscription. Use renew or device transfer."
        );
      }
    }

    const pendingSnap = await admin
      .firestore()
      .collection("mobile_user_requests")
      .where("licenseKey", "==", licenseKey)
      .where("userEmail", "==", userEmail)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!pendingSnap.empty) {
      throw new functions.https.HttpsError("failed-precondition", "A purchase request is already pending for this user");
    }

    const doc: MobileUserRequestDoc = {
      licenseKey,
      ownerEmail,
      ownerUid,
      userEmail,
      mobileNumber,
      displayName: displayName || userEmail,
      utr,
      amountInr: MOBILE_USER_ANNUAL_INR,
      upiPayee: GATEWAY_UPI_PAYEE,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await admin.firestore().collection("mobile_user_requests").add(doc);
    await writeAudit({
      type: "mobile_user_submit",
      licenseKey,
      email: ownerEmail,
      uid: ownerUid,
      ok: true,
      meta: { requestId: ref.id, userEmail, mobileNumber },
    });
    return { ok: true, requestId: ref.id };
  });

export const getMyMobileUserRequests = runWithWithAdmin({ maxInstances: 20 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    requireAuth(context);
    const ownerEmail = requireEmail(context);
    const clientKey = String(data?.licenseKey ?? "").trim().toUpperCase();
    const profileKey = await userLicenseKeyForEmail(ownerEmail);
    if (!profileKey) return { ok: true, items: [] as any[] };
    if (clientKey && clientKey !== profileKey) {
      throw new functions.https.HttpsError("permission-denied", "License key does not match your account");
    }

    const q = await admin
      .firestore()
      .collection("mobile_user_requests")
      .where("licenseKey", "==", profileKey)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const items = q.docs.map((d) => ({ id: d.id, ...(serializeFirestoreValue(d.data()) as any) }));
    return { ok: true, items };
  });

export const listMobileUsersForLicense = runWithWithAdmin({ maxInstances: 20 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    requireAuth(context);
    const ownerEmail = requireEmail(context);
    const clientKey = String(data?.licenseKey ?? "").trim().toUpperCase();
    const profileKey = await userLicenseKeyForEmail(ownerEmail);
    if (!profileKey) return { ok: true, items: [] as any[] };
    if (clientKey && clientKey !== profileKey) {
      throw new functions.https.HttpsError("permission-denied", "License key does not match your account");
    }

    const q = await admin
      .firestore()
      .collection("mobile_users")
      .where("licenseKey", "==", profileKey)
      .limit(100)
      .get();

    const items = q.docs.map((d) => {
      const raw = d.data() as any;
      return {
        id: d.id,
        ...(serializeFirestoreValue(raw) as any),
        pinHash: String(raw?.pinHash ?? ""),
      };
    });
    return { ok: true, items };
  });

export const listMobileUserRequests = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    try {
      await requireAdmin(context);
      const statusFilter = data?.status != null ? String(data.status) : "";
      const limitN = Math.min(Math.max(Number(data?.limit ?? 50), 1), 200);

      let snap: admin.firestore.QuerySnapshot;
      if (statusFilter === "pending" || statusFilter === "approved" || statusFilter === "rejected") {
        snap = await queryWithCreatedAtFallback(
          () =>
            admin
              .firestore()
              .collection("mobile_user_requests")
              .where("status", "==", statusFilter)
              .orderBy("createdAt", "desc")
              .limit(limitN)
              .get(),
          () =>
            admin
              .firestore()
              .collection("mobile_user_requests")
              .where("status", "==", statusFilter)
              .limit(limitN * 3)
              .get(),
          "listMobileUserRequests"
        );
      } else {
        snap = await queryWithCreatedAtFallback(
          () =>
            admin
              .firestore()
              .collection("mobile_user_requests")
              .orderBy("createdAt", "desc")
              .limit(limitN)
              .get(),
          () => admin.firestore().collection("mobile_user_requests").limit(limitN * 3).get(),
          "listMobileUserRequests"
        );
      }

      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(serializeFirestoreValue(d.data()) as any),
      }));
      return { ok: true, items: sortByCreatedAtDesc(items).slice(0, limitN) };
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      logger.error("listMobileUserRequests_failed", err);
      return { ok: true, items: [] };
    }
  });

export const listMobileUsersAdmin = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const limitN = Math.min(Math.max(Number(data?.limit ?? 100), 1), 300);
    const snap = await admin.firestore().collection("mobile_users").limit(limitN * 2).get();
    const items = snap.docs
      .map((d) => ({
        id: d.id,
        ...(serializeFirestoreValue(d.data()) as any),
        pinHash: undefined,
      }))
      .slice(0, limitN);
    return { ok: true, items };
  });

export const approveMobileUserRequest = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const adminUid = String(context.auth?.uid ?? "");
    const requestId = String(data?.requestId ?? "").trim();
    if (!requestId) {
      throw new functions.https.HttpsError("invalid-argument", "requestId required");
    }

    const reqRef = admin.firestore().doc(`mobile_user_requests/${requestId}`);
    let initialPin = "";
    let userDocId = "";

    await admin.firestore().runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Request not found");
      }
      const req = reqSnap.data() as MobileUserRequestDoc;
      if (String(req?.status ?? "") !== "pending") {
        throw new functions.https.HttpsError("failed-precondition", "Request is not pending");
      }

      const licenseKey = String(req.licenseKey ?? "").trim().toUpperCase();
      const userEmail = String(req.userEmail ?? "").trim().toLowerCase();
      userDocId = mobileUserId(licenseKey, userEmail);
      initialPin = generateMobilePin();
      const now = admin.firestore.FieldValue.serverTimestamp();
      const validUntil = admin.firestore.Timestamp.fromMillis(Date.now() + MOBILE_USER_PERIOD_MS);

      const userRef = admin.firestore().doc(`mobile_users/${userDocId}`);
      const userDoc: MobileUserDoc = {
        licenseKey,
        ownerEmail: String(req.ownerEmail ?? "").toLowerCase(),
        userEmail,
        mobileNumber: normalizeMobileNumber(req.mobileNumber),
        displayName: String(req.displayName || userEmail),
        pinHash: hashMobilePin(initialPin),
        status: "active",
        validFrom: now,
        validUntil,
        deviceId: null,
        deviceKey: null,
        deviceBoundAt: null,
        transferPending: false,
        createdAt: now,
        approvedAt: now,
        approvedByUid: adminUid,
        lastRequestId: requestId,
      };
      tx.set(userRef, userDoc, { merge: true });

      tx.set(
        reqRef,
        {
          status: "approved",
          reviewedAt: now,
          reviewedByUid: adminUid,
        },
        { merge: true }
      );
    });

    await writeAudit({
      type: "mobile_user_approve",
      licenseKey: userDocId.split("__")[0] || "",
      uid: adminUid,
      ok: true,
      meta: { requestId, userDocId },
    });

    return { ok: true, userId: userDocId, initialPin };
  });

export const rejectMobileUserRequest = runWithWithAdmin({ maxInstances: 5 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const adminUid = String(context.auth?.uid ?? "");
    const requestId = String(data?.requestId ?? "").trim();
    const reason = String(data?.reason ?? "").trim().slice(0, 500);
    if (!requestId) {
      throw new functions.https.HttpsError("invalid-argument", "requestId required");
    }

    const reqRef = admin.firestore().doc(`mobile_user_requests/${requestId}`);
    await admin.firestore().runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Request not found");
      }
      const req = reqSnap.data() as any;
      if (String(req?.status ?? "") !== "pending") {
        throw new functions.https.HttpsError("failed-precondition", "Request is not pending");
      }
      tx.set(
        reqRef,
        {
          status: "rejected",
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
          reviewedByUid: adminUid,
          rejectReason: reason || undefined,
        },
        { merge: true }
      );
    });
    return { ok: true };
  });

export const transferMobileUserDevice = runWithWithAdmin({ maxInstances: 10 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    const userId = String(data?.userId ?? "").trim();
    if (!userId) {
      throw new functions.https.HttpsError("invalid-argument", "userId required");
    }

    let isAdmin = false;
    try {
      await requireAdmin(context);
      isAdmin = true;
    } catch {
      requireAuth(context);
      const ownerEmail = requireEmail(context);
      const profileKey = await userLicenseKeyForEmail(ownerEmail);
      if (!profileKey) {
        throw new functions.https.HttpsError("permission-denied", "Not allowed");
      }
      const userRef = admin.firestore().doc(`mobile_users/${userId}`);
      const snap = await userRef.get();
      if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Mobile user not found");
      }
      const u = snap.data() as any;
      if (String(u?.licenseKey ?? "").toUpperCase() !== profileKey) {
        throw new functions.https.HttpsError("permission-denied", "Not your license");
      }
      if (String(u?.ownerEmail ?? "").toLowerCase() !== ownerEmail) {
        throw new functions.https.HttpsError("permission-denied", "Not allowed");
      }
    }

    const userRef = admin.firestore().doc(`mobile_users/${userId}`);
    await userRef.set(
      {
        deviceId: null,
        deviceKey: null,
        deviceBoundAt: null,
        transferPending: true,
        transferRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
        transferByUid: String(context.auth?.uid ?? ""),
        transferByAdmin: isAdmin,
      },
      { merge: true }
    );

    await writeAudit({
      type: "mobile_user_device_transfer",
      licenseKey: userId.split("__")[0] || "",
      uid: String(context.auth?.uid ?? ""),
      ok: true,
      meta: { userId, isAdmin },
    });
    return { ok: true };
  });

export const registerMobileUserDevice = runWithWithAdmin({ maxInstances: 20 }).https.onCall(async (data: any, context: functions.https.CallableContext) => {
    requireAuth(context);
    const ownerEmail = requireEmail(context);
    const userId = String(data?.userId ?? "").trim();
    const deviceId = String(data?.deviceId ?? "").trim();
    if (!userId || !deviceId) {
      throw new functions.https.HttpsError("invalid-argument", "userId and deviceId required");
    }

    const profileKey = await userLicenseKeyForEmail(ownerEmail);
    if (!profileKey) {
      throw new functions.https.HttpsError("failed-precondition", "No license on profile.");
    }

    const userRef = admin.firestore().doc(`mobile_users/${userId}`);
    const snap = await userRef.get();
    if (!snap.exists) {
      throw new functions.https.HttpsError("not-found", "Mobile user not found");
    }
    const u = snap.data() as any;
    if (String(u?.licenseKey ?? "").toUpperCase() !== profileKey) {
      throw new functions.https.HttpsError("permission-denied", "Not your license");
    }

    const dKey = deviceKey(deviceId);
    if (u?.deviceId && u?.deviceKey && u.deviceKey !== dKey && !u?.transferPending) {
      throw new functions.https.HttpsError("failed-precondition", "Device already bound. Request transfer first.");
    }

    await userRef.set(
      {
        deviceId,
        deviceKey: dKey,
        deviceBoundAt: admin.firestore.FieldValue.serverTimestamp(),
        transferPending: false,
      },
      { merge: true }
    );
    return { ok: true };
  });

export { createTrial, validateTrial, extendTrial, adminTrialAction } from './trial';
