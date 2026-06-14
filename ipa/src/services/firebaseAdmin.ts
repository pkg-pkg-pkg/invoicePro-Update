import admin from 'firebase-admin';

let initialized = false;

export function getFirebaseAdmin(): typeof admin | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  if (!initialized) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    initialized = true;
  }
  return admin;
}

export async function isSuperAdminUid(uid: string): Promise<boolean> {
  const fb = getFirebaseAdmin();
  if (!fb || !uid) return false;
  for (const collection of ['admins', 'admin', 'super_admins']) {
    const snap = await fb.firestore().collection(collection).doc(uid).get();
    if (snap.exists) {
      const active = snap.data()?.active;
      if (active === false) continue;
      return true;
    }
  }
  return false;
}
