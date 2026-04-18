/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as crypto from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });

type LicenseDoc = {
  licenseKey: string;
  version: 2;
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

function getSecret(): string {
  const s = String((functions.config() as any)?.license?.secret ?? "").trim();
  if (!s) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing functions config license.secret. Run: firebase functions:config:set license.secret=\"...\""
    );
  }
  return s;
}

function getOwnerEmails(): string[] {
  const cfg = (functions.config() as any)?.license;
  const raw = String(cfg?.owner_email ?? cfg?.owner_emails ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const becomeAdmin = functions
  .runWith({ maxInstances: 5 })
  .https.onCall(async (_data: any, context: functions.https.CallableContext) => {
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
  if (Array.isArray(v)) return v.map(serializeFirestoreValue);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) out[k] = serializeFirestoreValue((v as any)[k]);
    return out;
  }
  return v;
}

export const generateLicense = functions
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

    const body = base32Encode(crypto.randomBytes(BODY_BYTES));
    const sig = signBody(secret, body);
    const licenseKey = `${KEY_PREFIX}-${body}-${sig}`;

    const expiryDate =
      validityDays == null
        ? null
        : admin.firestore.Timestamp.fromMillis(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    const doc: LicenseDoc = {
      licenseKey,
      version: 2,
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

export const revokeLicense = functions
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const listLicenses = functions
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const activateLicense = functions
  .runWith({ maxInstances: 20 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const validateLicense = functions
  .runWith({ maxInstances: 20 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const transferLicense = functions
  .runWith({ maxInstances: 20 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const surrenderLicense = functions
  .runWith({ maxInstances: 20 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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
export const verifyActivationForLogin = functions
  .runWith({ maxInstances: 20 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const listAuditEvents = functions
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const limitN = Math.min(Math.max(Number(data?.limit ?? 100), 1), 500);
    const snap = await admin
      .firestore()
      .collectionGroup("events")
      .orderBy("createdAt", "desc")
      .limit(limitN)
      .get();
    const items = snap.docs.map((d) => {
      const raw = d.data() as any;
      return {
        id: d.id,
        ...serializeFirestoreValue(raw),
      };
    });
    return { ok: true, items };
  });

export const listUsers = functions
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const pageSize = Math.min(Math.max(Number(data?.pageSize ?? 200), 1), 500);
    const snap = await admin.firestore().collection("users").limit(pageSize).get();
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...(serializeFirestoreValue(d.data()) as any),
    }));
    return { ok: true, items };
  });

export const updateLicenseAdmin = functions
  .runWith({ maxInstances: 10 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const submitMultiUserUpgrade = functions
  .runWith({ maxInstances: 10 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const getMyMultiUserUpgradeStatus = functions
  .runWith({ maxInstances: 20 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const listMultiUserUpgradeRequests = functions
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const statusFilter = data?.status != null ? String(data.status) : "";
    let qy: admin.firestore.Query = admin
      .firestore()
      .collection("license_upgrade_requests")
      .orderBy("createdAt", "desc")
      .limit(Math.min(Math.max(Number(data?.limit ?? 50), 1), 200));

    if (statusFilter === "pending" || statusFilter === "approved" || statusFilter === "rejected") {
      qy = admin
        .firestore()
        .collection("license_upgrade_requests")
        .where("status", "==", statusFilter)
        .orderBy("createdAt", "desc")
        .limit(Math.min(Math.max(Number(data?.limit ?? 50), 1), 200));
    }

    const snap = await qy.get();
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...(serializeFirestoreValue(d.data()) as any),
    }));
    return { ok: true, items };
  });

export const approveMultiUserUpgradeRequest = functions
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const rejectMultiUserUpgradeRequest = functions
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const submitGatewayRenewal = functions
  .runWith({ maxInstances: 10 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const getMyGatewayRenewalStatus = functions
  .runWith({ maxInstances: 20 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const listGatewayRenewalRequests = functions
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await requireAdmin(context);
    const statusFilter = data?.status != null ? String(data.status) : "";
    let qy: admin.firestore.Query = admin
      .firestore()
      .collection("gateway_renewal_requests")
      .orderBy("createdAt", "desc")
      .limit(Math.min(Math.max(Number(data?.limit ?? 50), 1), 200));

    if (statusFilter === "pending" || statusFilter === "approved" || statusFilter === "rejected") {
      qy = admin
        .firestore()
        .collection("gateway_renewal_requests")
        .where("status", "==", statusFilter)
        .orderBy("createdAt", "desc")
        .limit(Math.min(Math.max(Number(data?.limit ?? 50), 1), 200));
    }

    const snap = await qy.get();
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...(serializeFirestoreValue(d.data()) as any),
    }));
    return { ok: true, items };
  });

export const approveGatewayRenewalRequest = functions
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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

export const rejectGatewayRenewalRequest = functions
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
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
