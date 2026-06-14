import { admin } from './adminBootstrap';

import * as functions from 'firebase-functions/v1';

import { onCallWithAdmin } from './functionsRuntime';



type LocationData = {

  ip_address: string;

  city: string;

  state: string;

  country: string;

  pincode: string;

  latitude: number;

  longitude: number;

  isp: string;

};



async function fetchLocationFromIp(): Promise<LocationData> {

  const empty: LocationData = {

    ip_address: '',

    city: '',

    state: '',

    country: 'India',

    pincode: '',

    latitude: 0,

    longitude: 0,

    isp: '',

  };

  try {

    const ipRes = await fetch('https://ipapi.co/json/');

    const ipData = (await ipRes.json()) as Record<string, unknown>;

    return {

      ip_address: String(ipData.ip ?? ''),

      city: String(ipData.city ?? ''),

      state: String(ipData.region ?? ''),

      country: String(ipData.country_name ?? 'India'),

      pincode: String(ipData.postal ?? ''),

      latitude: Number(ipData.latitude ?? 0),

      longitude: Number(ipData.longitude ?? 0),

      isp: String(ipData.org ?? ''),

    };

  } catch {

    return empty;

  }

}



function normalizeMobile(raw: string): string {

  return String(raw ?? '').replace(/\D/g, '').slice(-10);

}



function deviceFingerprintFrom(data: Record<string, unknown>): string {

  const fp = String(data.device_fingerprint ?? '').trim();

  if (fp) return fp;

  return String(data.device_id ?? '').trim();

}



async function logTrialRejection(

  reason: string,

  meta: Record<string, unknown>

): Promise<void> {

  const db = admin.firestore();

  const now = admin.firestore.Timestamp.now();

  try {

    await db.collection('trial_rejection_logs').add({

      reason,

      mobile_no: String(meta.mobile_no ?? ''),

      device_id: String(meta.device_id ?? ''),

      device_fingerprint: String(meta.device_fingerprint ?? ''),

      company_id: String(meta.company_id ?? ''),

      created_at: now,

      ...meta,

    });

  } catch (err) {

    functions.logger.warn('trial_rejection_log_failed', { reason, err: String(err) });

  }

}



async function rejectTrial(

  reason: string,

  code: functions.https.FunctionsErrorCode,

  message: string,

  meta: Record<string, unknown>

): Promise<never> {

  await logTrialRejection(reason, meta);

  throw new functions.https.HttpsError(code, message);

}



async function deviceTrialExists(

  db: FirebaseFirestore.Firestore,

  deviceId: string,

  fingerprint: string

): Promise<boolean> {

  const queries: Promise<FirebaseFirestore.QuerySnapshot>[] = [];

  if (deviceId) {

    queries.push(

      db.collection('trials').where('device_id', '==', deviceId).limit(1).get(),

      db.collection('trials').where('devices_used', 'array-contains', deviceId).limit(1).get()

    );

  }

  if (fingerprint && fingerprint !== deviceId) {

    queries.push(

      db.collection('trials').where('device_fingerprint', '==', fingerprint).limit(1).get(),

      db

        .collection('trials')

        .where('fingerprints_used', 'array-contains', fingerprint)

        .limit(1)

        .get()

    );

  }

  if (!queries.length) return false;

  const results = await Promise.all(queries);

  return results.some((qs) => !qs.empty);

}



async function activeCompanyTrialExists(

  db: FirebaseFirestore.Firestore,

  companyId: string,

  excludeMobile?: string

): Promise<boolean> {

  if (!companyId) return false;

  const qs = await db

    .collection('trials')

    .where('company_id', '==', companyId)

    .where('is_expired', '==', false)

    .limit(5)

    .get();

  return qs.docs.some((d) => {

    const mobile = String(d.data().mobile_no ?? d.id);

    if (excludeMobile && mobile === excludeMobile) return false;

    const converted = Boolean(d.data().converted_to_paid);

    return !converted;

  });

}



async function requireAdmin(context: functions.https.CallableContext): Promise<void> {

  if (!context.auth?.uid) {

    throw new functions.https.HttpsError('unauthenticated', 'Sign in required');

  }

  const uid = context.auth.uid;

  const db = admin.firestore();

  const adminSnap = await db.doc(`admins/${uid}`).get();

  const legacySnap = await db.doc(`admin/${uid}`).get();

  if (!adminSnap.exists && !legacySnap.exists) {

    throw new functions.https.HttpsError('permission-denied', 'Admin only');

  }

}



export const createTrial = onCallWithAdmin(async (data: Record<string, unknown>) => {

  const db = admin.firestore();

  const now = admin.firestore.Timestamp.now();

  const endDate = new admin.firestore.Timestamp(now.seconds + 7 * 24 * 60 * 60, now.nanoseconds);



  const mobileNo = normalizeMobile(String(data.mobile_no ?? ''));

  const deviceId = String(data.device_id ?? '').trim();

  const fingerprint = deviceFingerprintFrom(data);

  const companyId = String(data.company_id ?? '').trim();



  const meta = {

    mobile_no: mobileNo,

    device_id: deviceId,

    device_fingerprint: fingerprint,

    company_id: companyId,

  };



  if (mobileNo.length !== 10) {

    await rejectTrial('invalid_mobile', 'invalid-argument', 'Valid 10-digit mobile required', meta);

  }



  const docRef = db.collection('trials').doc(mobileNo);

  const existing = await docRef.get();

  if (existing.exists) {

    await rejectTrial(

      'duplicate_mobile',

      'already-exists',

      'Trial already exists for this mobile',

      meta

    );

  }



  if (await deviceTrialExists(db, deviceId, fingerprint)) {

    await rejectTrial(

      'duplicate_device',

      'failed-precondition',

      'A trial has already been used on this device.',

      meta

    );

  }



  if (await activeCompanyTrialExists(db, companyId)) {

    await rejectTrial(

      'duplicate_company',

      'failed-precondition',

      'An active trial already exists for this company.',

      meta

    );

  }



  const clientLocation = (data.location ?? {}) as Record<string, unknown>;

  const locationData = Object.keys(clientLocation).length

    ? {

        ip_address: String(clientLocation.ip_address ?? ''),

        city: String(clientLocation.city ?? ''),

        state: String(clientLocation.state ?? ''),

        country: String(clientLocation.country ?? 'India'),

        pincode: String(clientLocation.pincode ?? ''),

        latitude: Number(clientLocation.latitude ?? 0),

        longitude: Number(clientLocation.longitude ?? 0),

        isp: String(clientLocation.isp ?? ''),

      }

    : await fetchLocationFromIp();



  const userPin = String(data.user_pincode ?? '').trim();

  const trialDoc = {

    mobile_no: mobileNo,

    otp_verified: true,

    phone_uid: String(data.phone_uid ?? ''),

    trial_start_date: now,

    trial_end_date: endDate,

    created_at: now,

    last_login: now,

    updated_at: now,

    device_id: deviceId,

    device_fingerprint: fingerprint,

    device_name: String(data.device_name ?? ''),

    os_info: String(data.os_info ?? ''),

    company_id: companyId || null,

    devices_used: [deviceId].filter(Boolean),

    fingerprints_used: [fingerprint].filter(Boolean),

    location: {

      ...locationData,

      user_pincode: userPin,

      final_pincode: userPin || locationData.pincode || '',

    },

    is_expired: false,

    days_remaining: 7,

    login_count: 1,

    converted_to_paid: false,

    block_reason: '',

  };



  await docRef.set(trialDoc);



  return {

    success: true,

    end_date: endDate,

    days_remaining: 7,

    location: locationData,

  };

});



export const validateTrial = onCallWithAdmin(async (data: Record<string, unknown>) => {

  const db = admin.firestore();

  const now = admin.firestore.Timestamp.now();

  const mobileNo = normalizeMobile(String(data.mobile_no ?? ''));

  const deviceId = String(data.device_id ?? '').trim();

  const fingerprint = deviceFingerprintFrom(data);

  const companyId = String(data.company_id ?? '').trim();



  if (mobileNo.length === 10) {

    const mobileDoc = await db.collection('trials').doc(mobileNo).get();

    if (mobileDoc.exists) {

      const trial = mobileDoc.data() as Record<string, unknown>;

      await mobileDoc.ref.update({

        last_login: now,

        login_count: admin.firestore.FieldValue.increment(1),

        updated_at: now,

        ...(companyId && !trial.company_id ? { company_id: companyId } : {}),

      });



      const endTs = trial.trial_end_date as admin.firestore.Timestamp;

      if (endTs && now.seconds > endTs.seconds) {

        await mobileDoc.ref.update({

          is_expired: true,

          block_reason: 'trial_expired',

          updated_at: now,

        });

        return {

          status: 'EXPIRED',

          message: 'Trial period over',

          trial_end_date: endTs,

          mobile_no: mobileNo,

        };

      }



      const daysLeft = endTs

        ? Math.max(0, Math.ceil((endTs.seconds - now.seconds) / 86400))

        : 0;

      await mobileDoc.ref.update({ days_remaining: daysLeft, updated_at: now });



      if (trial.converted_to_paid) {

        return { status: 'EXPIRED', message: 'Already converted to paid license' };

      }



      return {

        status: 'VALID',

        days_remaining: daysLeft,

        trial_end_date: endTs,

        mobile_no: mobileNo,

      };

    }

  }



  if (await deviceTrialExists(db, deviceId, fingerprint)) {

    await logTrialRejection('validate_device_blocked', {

      mobile_no: mobileNo,

      device_id: deviceId,

      device_fingerprint: fingerprint,

      company_id: companyId,

    });

    return {

      status: 'DEVICE_BLOCKED',

      message: 'A trial has already been used on this device.',

    };

  }



  if (await activeCompanyTrialExists(db, companyId, mobileNo || undefined)) {

    await logTrialRejection('validate_company_blocked', {

      mobile_no: mobileNo,

      device_id: deviceId,

      device_fingerprint: fingerprint,

      company_id: companyId,

    });

    return {

      status: 'COMPANY_BLOCKED',

      message: 'An active trial already exists for this company.',

    };

  }



  return { status: 'NEW_USER' };

});



export const extendTrial = onCallWithAdmin(async (data: Record<string, unknown>, context) => {

  await requireAdmin(context);

  const db = admin.firestore();

  const now = admin.firestore.Timestamp.now();

  const mobileNo = normalizeMobile(String(data.mobile_no ?? ''));

  const extraDays = Number(data.extra_days ?? 7);



  const docRef = db.collection('trials').doc(mobileNo);

  const snap = await docRef.get();

  if (!snap.exists) {

    return { success: false, error: 'Trial not found' };

  }



  const trial = snap.data() as Record<string, unknown>;

  const currentEnd = trial.trial_end_date as admin.firestore.Timestamp;

  const newEnd = new admin.firestore.Timestamp(

    currentEnd.seconds + extraDays * 24 * 60 * 60,

    currentEnd.nanoseconds

  );



  await docRef.update({

    trial_end_date: newEnd,

    is_expired: false,

    block_reason: '',

    days_remaining: extraDays,

    updated_at: now,

  });



  return { success: true, new_end: newEnd };

});



export const adminTrialAction = onCallWithAdmin(async (data: Record<string, unknown>, context) => {

  await requireAdmin(context);

  const db = admin.firestore();

  const now = admin.firestore.Timestamp.now();

  const mobileNo = normalizeMobile(String(data.mobile_no ?? ''));

  const action = String(data.action ?? '');

  const docRef = db.collection('trials').doc(mobileNo);

  const snap = await docRef.get();

  if (!snap.exists) {

    throw new functions.https.HttpsError('not-found', 'Trial not found');

  }



  if (action === 'reset_device') {

    await docRef.update({ devices_used: [], fingerprints_used: [], updated_at: now });

    return { ok: true };

  }

  if (action === 'mark_converted') {

    await docRef.update({ converted_to_paid: true, updated_at: now });

    return { ok: true };

  }

  if (action === 'block') {

    await docRef.update({ is_expired: true, block_reason: 'admin_blocked', updated_at: now });

    return { ok: true };

  }



  throw new functions.https.HttpsError('invalid-argument', 'Unknown action');

});


