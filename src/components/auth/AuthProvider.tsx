"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  updateProfile,
  type ActionCodeSettings,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { auth, db } from "@/lib/firebase";

type AuthContextValue = {
  completeEmailLinkSignIn: (email: string, link: string) => Promise<User>;
  getFreshIdToken: () => Promise<string | null>;
  isEmailLink: (link: string) => boolean;
  loading: boolean;
  sendEmailSignInLink: (email: string, redirectTo: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  signOutUser: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<User>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);
export const EMAIL_LINK_STORAGE_KEY = "ryandea-email-for-sign-in";

function buildEmailLinkActionSettings(redirectTo: string): ActionCodeSettings {
  const redirectUrl = new URL("/sign-in", window.location.origin);

  redirectUrl.searchParams.set("redirect", redirectTo);

  return {
    handleCodeInApp: true,
    url: redirectUrl.toString(),
  };
}

async function syncUserProfile(user: User) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      displayName: user.displayName ?? "",
      email: user.email ?? "",
      lastLoginAt: serverTimestamp(),
      photoURL: user.photoURL ?? "",
      providerIds: user.providerData.map((provider) => provider.providerId),
      uid: user.uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  ).catch((error) => {
    console.warn("Could not sync Firebase user profile", error);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);

      if (nextUser) {
        void syncUserProfile(nextUser);
      }
    });

    return unsubscribe;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await syncUserProfile(credential.user);

    return credential.user;
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      if (displayName?.trim()) {
        await updateProfile(credential.user, {
          displayName: displayName.trim(),
        });
      }

      await syncUserProfile(credential.user);

      return credential.user;
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: "select_account",
    });

    const credential = await signInWithPopup(auth, provider);
    await syncUserProfile(credential.user);

    return credential.user;
  }, []);

  const sendEmailSignInLink = useCallback(async (email: string, redirectTo: string) => {
    const normalizedEmail = email.trim();

    await sendSignInLinkToEmail(
      auth,
      normalizedEmail,
      buildEmailLinkActionSettings(redirectTo),
    );

    window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, normalizedEmail);
  }, []);

  const isEmailLink = useCallback((link: string) => isSignInWithEmailLink(auth, link), []);

  const completeEmailLinkSignIn = useCallback(async (email: string, link: string) => {
    const credential = await signInWithEmailLink(auth, email.trim(), link);

    window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
    await syncUserProfile(credential.user);

    return credential.user;
  }, []);

  const signOutUser = useCallback(() => signOut(auth), []);

  const getFreshIdToken = useCallback(async () => {
    if (!auth.currentUser) {
      return null;
    }

    return auth.currentUser.getIdToken();
  }, []);

  const value = useMemo(
    () => ({
      completeEmailLinkSignIn,
      getFreshIdToken,
      isEmailLink,
      loading,
      sendEmailSignInLink,
      signInWithEmail,
      signInWithGoogle,
      signOutUser,
      signUpWithEmail,
      user,
    }),
    [
      completeEmailLinkSignIn,
      getFreshIdToken,
      isEmailLink,
      loading,
      sendEmailSignInLink,
      signInWithEmail,
      signInWithGoogle,
      signOutUser,
      signUpWithEmail,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
