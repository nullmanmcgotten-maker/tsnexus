import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Google Auth Provider with Google Drive Read-Only Scope
export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

const provider = new GoogleAuthProvider();
DRIVE_SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory caching for access token (never stored in localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let currentUser: User | null = null;

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

type AuthCallback = (state: AuthState) => void;
const listeners = new Set<AuthCallback>();

const notifyListeners = () => {
  const state: AuthState = {
    user: currentUser,
    accessToken: cachedAccessToken,
    isAuthenticated: !!(currentUser && cachedAccessToken),
  };
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (e) {
      console.error('[Auth Listener Error]', e);
    }
  });
};

export const subscribeAuthState = (callback: AuthCallback): (() => void) => {
  listeners.add(callback);
  callback({
    user: currentUser,
    accessToken: cachedAccessToken,
    isAuthenticated: !!(currentUser && cachedAccessToken),
  });
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Initialize auth state listener. Clears cached token when signed out.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    currentUser = user;
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        notifyListeners();
      } else if (!isSigningIn) {
        // Needs fresh sign-in to acquire token
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
        notifyListeners();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
      notifyListeners();
    }
  });
};

/**
 * Google Sign-In with popup. Acquires Google OAuth Access Token.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive access token from authentication.');
    }

    currentUser = result.user;
    cachedAccessToken = credential.accessToken;
    notifyListeners();
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('[Google Sign-In Error]', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current in-memory cached access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Log out and purge token
 */
export const logout = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  currentUser = null;
  notifyListeners();
};
