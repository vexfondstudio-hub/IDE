import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { createUserProfile } from "./db";

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Enable persistence so the user doesn't have to log in repeatedly
setPersistence(auth, browserLocalPersistence).catch(console.error);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/gmail.send");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void,
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Update last login or create profile on standard auth state change if needed
      if (user.email) {
        createUserProfile(user.uid, user.email).catch(console.error);
      }
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Firebase Auth");
    }

    cachedAccessToken = credential.accessToken;
    
    // Create or update user profile in Firestore
    if (result.user.email) {
      await createUserProfile(result.user.uid, result.user.email);
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const emailSignUp = async (email: string, password: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (result.user.email) {
      await createUserProfile(result.user.uid, result.user.email);
    }
    return result.user;
  } catch (error: any) {
    throw error;
  }
};

export const emailSignIn = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    // Create or update user profile in Firestore
    if (result.user.email) {
      await createUserProfile(result.user.uid, result.user.email);
    }
    return result.user;
  } catch (error: any) {
    throw error;
  }
}

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
