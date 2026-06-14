import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type Auth,
  type ConfirmationResult,
} from 'firebase/auth';
import { auth } from '../firebase/firebase';

let recaptchaVerifier: RecaptchaVerifier | null = null;
let recaptchaContainer: HTMLElement | null = null;
let confirmationResult: ConfirmationResult | null = null;
let containerSeq = 0;

export function formatIndiaPhone(raw: string): string {
  const mobile = String(raw ?? '').replace(/\D/g, '').slice(-10);
  if (mobile.length !== 10) {
    throw new Error('Enter a valid 10-digit mobile number');
  }
  return `+91${mobile}`;
}

function parseFirebasePhoneAuthError(err: unknown, fallback: string): string {
  const code = String((err as { code?: string })?.code ?? '');
  const message = String((err as { message?: string })?.message ?? '').trim();

  if (code === 'auth/invalid-phone-number') return 'Enter a valid 10-digit mobile number';
  if (code === 'auth/missing-phone-number') return 'Enter a valid mobile number';
  if (code === 'auth/invalid-verification-code') return 'Invalid OTP. Please try again.';
  if (code === 'auth/code-expired') return 'OTP expired. Please request a new code.';
  if (code === 'auth/session-expired') return 'OTP expired. Please request a new code.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait and try again.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your internet connection.';
  if (code === 'auth/captcha-check-failed') {
    return 'Phone verification failed. Restart the app and try again.';
  }
  if (code === 'auth/operation-not-supported-in-this-environment') {
    return 'Phone verification is not supported in this environment. Use the latest app build.';
  }
  if (message.includes('already been rendered')) {
    return 'Verification widget conflict. Please wait a moment and tap Send OTP again.';
  }
  if (message.includes('MALFORMED')) {
    return 'Phone verification failed. Ensure the app loads over http://127.0.0.1 and try again.';
  }

  return message.replace(/^Firebase:\s*/i, '') || fallback;
}

function destroyRecaptchaWidget(): void {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // ignore stale widget cleanup
    }
    recaptchaVerifier = null;
  }
  if (recaptchaContainer) {
    recaptchaContainer.remove();
    recaptchaContainer = null;
  }
  document.querySelectorAll('[data-trial-recaptcha="1"]').forEach((node) => node.remove());
}

async function createRecaptchaVerifier(firebaseAuth: Auth): Promise<RecaptchaVerifier> {
  destroyRecaptchaWidget();

  containerSeq += 1;
  const container = document.createElement('div');
  container.id = `trial-recaptcha-${containerSeq}`;
  container.dataset.trialRecaptcha = '1';
  container.setAttribute('aria-hidden', 'true');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.width = '1px';
  container.style.height = '1px';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);
  recaptchaContainer = container;

  const verifier = new RecaptchaVerifier(firebaseAuth, container, {
    size: 'invisible',
  });
  await verifier.render();
  recaptchaVerifier = verifier;
  return verifier;
}

/** Send OTP via Firebase Phone Authentication (+91 numbers supported). */
export async function sendFirebasePhoneOtp(phoneE164: string): Promise<void> {
  if (!auth) throw new Error('Firebase Auth is not configured');

  const phone = phoneE164.trim().startsWith('+') ? phoneE164.trim() : formatIndiaPhone(phoneE164);

  try {
    const verifier = await createRecaptchaVerifier(auth);
    confirmationResult = await signInWithPhoneNumber(auth, phone, verifier);
  } catch (err) {
    confirmationResult = null;
    destroyRecaptchaWidget();
    throw new Error(parseFirebasePhoneAuthError(err, 'Could not send OTP. Please try again.'));
  }
}

/** Verify OTP using Firebase ConfirmationResult.confirm(). */
export async function verifyFirebasePhoneOtp(
  code: string
): Promise<{ localId: string; idToken: string }> {
  if (!confirmationResult) {
    throw new Error('OTP session expired. Please request a new code.');
  }

  try {
    const credential = await confirmationResult.confirm(code.trim());
    const idToken = await credential.user.getIdToken();
    const localId = credential.user.uid;
    await signOut(auth).catch(() => undefined);
    resetFirebasePhoneOtpSession();
    return { localId, idToken };
  } catch (err) {
    throw new Error(parseFirebasePhoneAuthError(err, 'OTP verification failed'));
  }
}

export function resetFirebasePhoneOtpSession(): void {
  confirmationResult = null;
  destroyRecaptchaWidget();
}
