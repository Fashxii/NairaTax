import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut as fbSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken, type AppCheck } from 'firebase/app-check';

// The Firebase web config is public by design. Access is controlled by
// firestore.rules, Cloud Function checks, App Check and API-key restrictions.
const firebaseConfig = {
  apiKey: "AIzaSyCkAjdxP3O3vMYCH0_h2s0tIzLvnYqHgNU",
  authDomain: "nairatax-6128f.firebaseapp.com",
  projectId: "nairatax-6128f",
  storageBucket: "nairatax-6128f.firebasestorage.app",
  messagingSenderId: "191926361557",
  appId: "1:191926361557:web:67c85cae5a0e4d9c5db15c",
  measurementId: "G-7YN5K8Q5VW"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * Firebase App Check (reCAPTCHA Enterprise). Proves requests come from this
 * web app rather than a script. Activated when VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
 * is set at build time; Firestore and the Cloud Functions then receive tokens.
 */
let appCheck: AppCheck | null = null;
const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY as string | undefined;
if (typeof window !== 'undefined' && siteKey) {
  try {
    if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
        import.meta.env.VITE_APPCHECK_DEBUG_TOKEN as string;
    }
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('[AppCheck] initialisation skipped:', err);
  }
}

/** `X-Firebase-AppCheck` header for fetch() calls to our Cloud Functions. */
export async function appCheckHeaders(): Promise<Record<string, string>> {
  if (!appCheck) return {};
  try {
    const { token } = await getToken(appCheck, false);
    return token ? { 'X-Firebase-AppCheck': token } : {};
  } catch {
    return {};
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);

export { signInWithCustomToken, fbSignOut, onAuthStateChanged };
export type { User };
