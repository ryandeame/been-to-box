"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Loader2, LockKeyhole, Mail, Send, Sparkles } from "lucide-react";

import { EMAIL_LINK_STORAGE_KEY, useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/lib/firebase";

type AuthMode = "sign-in" | "sign-up";

const authCopy = {
  "sign-in": {
    alternateHref: "/sign-up",
    alternateText: "Need an account? Sign up",
    buttonText: "Sign in",
    eyebrow: "Welcome back",
    heading: "Open your travel archive.",
    subheading: "Get a one-time email code by default, or use your password if you already have one.",
  },
  "sign-up": {
    alternateHref: "/sign-in",
    alternateText: "Already have an account? Sign in",
    buttonText: "Create account",
    eyebrow: "Start collecting",
    heading: "Create your Been-To-Box account.",
    subheading: "Start with a passwordless email code, Google, or create an email/password account if you prefer.",
  },
} satisfies Record<AuthMode, {
  alternateHref: string;
  alternateText: string;
  buttonText: string;
  eyebrow: string;
  heading: string;
  subheading: string;
}>;

function getFriendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "Authentication failed.";

  if (message.includes("auth/invalid-credential")) {
    return "That email/password combination did not work.";
  }

  if (message.includes("auth/email-already-in-use")) {
    return "That email already has an account. Try signing in instead.";
  }

  if (message.includes("auth/weak-password")) {
    return "Use a password with at least 6 characters.";
  }

  if (message.includes("auth/popup-closed-by-user")) {
    return "The Google sign-in popup was closed before finishing.";
  }

  if (message.includes("auth/invalid-action-code")) {
    return "That sign-in link is expired or has already been used. Request a fresh link.";
  }

  if (message.includes("auth/unauthorized-continue-uri")) {
    return "This domain is not authorized for Firebase email-link sign-in yet.";
  }

  return message.replace("Firebase: ", "");
}

function getSafeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

async function getSignedInProfileRedirect(user: User) {
  const firestoreUsername = await getSignedInUsernameFromFirestore(user);

  if (firestoreUsername) {
    return `/${firestoreUsername}`;
  }

  return "/profile";
}

async function getSignedInUsernameFromFirestore(user: User) {
  try {
    const profileSnapshot = await getDoc(doc(db, "users", user.uid));
    const username = profileSnapshot.data()?.username;

    return typeof username === "string" && username.length > 0 ? username : null;
  } catch (profileError) {
    console.warn("Could not resolve signed-in profile from Firestore", profileError);
    return null;
  }
}

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    completeEmailLinkSignIn,
    isEmailLink,
    loading,
    sendEmailSignInLink,
    signInWithEmail,
    signInWithGoogle,
    signUpWithEmail,
    user,
  } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailLinkNeedsEmail, setEmailLinkNeedsEmail] = useState(false);
  const [error, setError] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const copy = authCopy[mode];
  const explicitRedirectTo = useMemo(
    () => getSafeRedirect(searchParams.get("redirect")),
    [searchParams],
  );
  const emailLinkRedirectTo = explicitRedirectTo ?? "/";

  const finishAuth = useCallback(
    async (signedInUser?: User | null) => {
      if (explicitRedirectTo && explicitRedirectTo !== "/") {
        router.replace(explicitRedirectTo);
        return;
      }

      const resolvedRedirect = signedInUser
        ? await getSignedInProfileRedirect(signedInUser)
        : "/profile";

      router.replace(resolvedRedirect);
    },
    [explicitRedirectTo, router],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setMounted(true), 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const currentLink = window.location.href;

    if (!isEmailLink(currentLink)) {
      return;
    }

    const storedEmail = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);

    if (!storedEmail) {
      const timeoutId = window.setTimeout(() => {
        setUsePassword(false);
        setEmailLinkNeedsEmail(true);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    let isMounted = true;

    const completeStoredEmailLink = async () => {
      setSubmitting(true);
      setError("");

      try {
        const signedInUser = await completeEmailLinkSignIn(storedEmail, currentLink);

        if (isMounted) {
          await finishAuth(signedInUser);
        }
      } catch (authError) {
        if (isMounted) {
          setError(getFriendlyAuthError(authError));
        }
      } finally {
        if (isMounted) {
          setSubmitting(false);
        }
      }
    };

    void completeStoredEmailLink();

    return () => {
      isMounted = false;
    };
  }, [completeEmailLinkSignIn, finishAuth, isEmailLink, mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (!loading && user) {
      void finishAuth(user);
    }
  }, [finishAuth, loading, mounted, user]);

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (emailLinkNeedsEmail) {
        const signedInUser = await completeEmailLinkSignIn(email.trim(), window.location.href);
        await finishAuth(signedInUser);
        return;
      }

      if (!usePassword) {
        await sendEmailSignInLink(email.trim(), emailLinkRedirectTo);
        setLinkSent(true);
        return;
      }

      let signedInUser: User;

      if (mode === "sign-up") {
        signedInUser = await signUpWithEmail(email.trim(), password, displayName);
      } else {
        signedInUser = await signInWithEmail(email.trim(), password);
      }

      await finishAuth(signedInUser);
    } catch (authError) {
      setError(getFriendlyAuthError(authError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setSubmitting(true);

    try {
      const signedInUser = await signInWithGoogle();
      await finishAuth(signedInUser);
    } catch (authError) {
      setError(getFriendlyAuthError(authError));
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) {
    return <AuthTransitionScreen />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8edcf] px-4 py-6 text-[#24110c] sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#f97316]/30 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#14b8a6]/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#8b5cf6]/20 blur-3xl" />
      </div>

      <section className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl place-items-center">
        <div className="w-full">
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-[#24110c]/15 bg-white/55 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-[#24110c] shadow-[0_8px_0_rgba(36,17,12,0.12)] transition-transform hover:-translate-y-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to box
          </Link>

          <div className="grid overflow-hidden rounded-[2.75rem] border-[10px] border-[#151313] bg-[#8f1110] p-3 shadow-[0_34px_80px_rgba(36,17,12,0.28)] lg:grid-cols-[1fr_0.9fr]">
            <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] bg-[#061329] p-8 text-[#f8edcf]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.34),transparent_32%),radial-gradient(circle_at_78%_70%,rgba(20,184,166,0.3),transparent_34%)]" />
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-[24px] border-[#facc15]/50" />
              <div className="absolute bottom-8 right-8 grid h-28 w-28 place-items-center rounded-full bg-[#facc15] text-[#24110c] shadow-[0_12px_0_rgba(0,0,0,0.25)]">
                <Sparkles className="h-10 w-10" />
              </div>

              <div className="relative max-w-xl">
                <p className="inline-flex rounded-full bg-[#facc15] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#24110c] shadow-[0_6px_0_rgba(0,0,0,0.24)]">
                  {copy.eyebrow}
                </p>
                <h1 className="mt-8 text-5xl font-black leading-[0.9] tracking-tight drop-shadow-[0_5px_0_rgba(0,0,0,0.35)] sm:text-7xl">
                  {copy.heading}
                </h1>
                <p className="mt-6 text-xl font-bold leading-8 text-[#f8edcf]/88">
                  {copy.subheading}
                </p>
              </div>
            </div>

            <form
              className="grid gap-5 rounded-[2rem] bg-[#fff4cf] p-6 sm:p-8"
              onSubmit={handleEmailAuth}
            >
              <div className="rounded-[1.5rem] border-2 border-[#24110c]/15 bg-[#f8edcf] p-4 shadow-[inset_0_-4px_0_rgba(36,17,12,0.08)]">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8f1110]">
                  {usePassword ? "Password sign in" : "Passwordless sign in"}
                </p>
              </div>

              {mode === "sign-up" && usePassword && !emailLinkNeedsEmail ? (
                <label className="grid gap-2">
                  <span className="text-sm font-black uppercase tracking-[0.16em]">
                    Name
                  </span>
                  <input
                    className="rounded-[1.35rem] border-[3px] border-[#24110c] bg-[#f8edcf] px-5 py-4 text-lg font-black outline-none shadow-[inset_0_-5px_0_rgba(36,17,12,0.08),0_7px_0_rgba(36,17,12,0.16)] transition-transform focus:-translate-y-0.5 focus:border-[#8f1110]"
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Ryan Deame"
                    value={displayName}
                  />
                </label>
              ) : null}

              <label className="grid gap-2">
                <span className="text-sm font-black uppercase tracking-[0.16em]">
                  Email
                </span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8f1110]" />
                  <input
                    className="w-full rounded-[1.35rem] border-[3px] border-[#24110c] bg-[#f8edcf] px-5 py-4 pl-14 text-lg font-black outline-none shadow-[inset_0_-5px_0_rgba(36,17,12,0.08),0_7px_0_rgba(36,17,12,0.16)] transition-transform focus:-translate-y-0.5 focus:border-[#8f1110]"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>
              </label>

              {usePassword && !emailLinkNeedsEmail ? (
                <label className="grid gap-2">
                  <span className="text-sm font-black uppercase tracking-[0.16em]">
                    Password
                  </span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8f1110]" />
                    <input
                      className="w-full rounded-[1.35rem] border-[3px] border-[#24110c] bg-[#f8edcf] px-5 py-4 pl-14 text-lg font-black outline-none shadow-[inset_0_-5px_0_rgba(36,17,12,0.08),0_7px_0_rgba(36,17,12,0.16)] transition-transform focus:-translate-y-0.5 focus:border-[#8f1110]"
                      minLength={6}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="6+ characters"
                      required
                      type="password"
                      value={password}
                    />
                  </div>
                </label>
              ) : null}

              {!usePassword ? (
                <div className="rounded-[1.5rem] border-2 border-[#24110c]/15 bg-[#facc15]/45 p-4 text-sm font-bold leading-6 text-[#8f1110]">
                  {emailLinkNeedsEmail
                    ? "Enter the same email address you used to request this link so Firebase can finish signing you in."
                    : "No password needed. Check your inbox after submitting and open the Firebase sign-in link."}
                </div>
              ) : null}

              {linkSent ? (
                <div className="rounded-[1.5rem] border-2 border-[#14b8a6]/40 bg-[#14b8a6]/15 p-5 text-[#06251f]">
                  <p className="text-xl font-black">Check your email.</p>
                  <p className="mt-2 text-sm font-bold leading-6">
                    We sent a one-time sign-in link to {email.trim()}. Open it to finish signing in, and check your spam folder if it does not show up in a minute or two.
                  </p>
                </div>
              ) : null}

              {!emailLinkNeedsEmail ? (
                <label className="flex cursor-pointer items-center gap-3 rounded-[1.25rem] border-2 border-[#24110c]/10 bg-white/60 px-4 py-3 text-sm font-black text-[#24110c]">
                  <input
                    checked={usePassword}
                    className="h-5 w-5 accent-[#8f1110]"
                    onChange={(event) => {
                      setUsePassword(event.target.checked);
                      setError("");
                      setLinkSent(false);
                    }}
                    type="checkbox"
                  />
                  Use a password instead
                </label>
              ) : null}

              {error ? (
                <p className="rounded-2xl bg-[#8f1110] px-4 py-3 text-sm font-bold text-[#fff4cf]">
                  {error}
                </p>
              ) : null}

              <button
                className="rounded-full bg-[#8f1110] px-7 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#fff4cf] shadow-[0_9px_0_rgba(36,17,12,0.22)] disabled:opacity-60"
                disabled={submitting}
                type="submit"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Working...
                  </span>
                ) : (
                  !usePassword ? (
                    <span className="inline-flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      {emailLinkNeedsEmail ? "Complete sign in" : "Send email code"}
                    </span>
                  ) : (
                    copy.buttonText
                  )
                )}
              </button>

              <button
                className="rounded-full border-2 border-[#24110c]/15 bg-white px-7 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#24110c] shadow-[0_8px_0_rgba(36,17,12,0.12)] disabled:opacity-60"
                disabled={submitting}
                onClick={handleGoogleAuth}
                type="button"
              >
                Continue with Google
              </button>

              <Link
                className="text-center text-sm font-black uppercase tracking-[0.14em] text-[#8f1110] underline decoration-[#f97316] decoration-4 underline-offset-4"
                href={`${copy.alternateHref}?redirect=${encodeURIComponent(emailLinkRedirectTo)}`}
              >
                {copy.alternateText}
              </Link>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthTransitionScreen() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f8edcf] px-4 py-6 text-[#24110c]">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#f97316]/30 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#14b8a6]/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#8b5cf6]/20 blur-3xl" />
      </div>
      <div className="relative rounded-[2rem] border-[8px] border-[#151313] bg-[#fff4cf] px-8 py-7 text-center shadow-[0_18px_0_rgba(36,17,12,0.16)]">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#8f1110]" />
        <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-[#8f1110]">
          Opening your Been-To-Box
        </p>
      </div>
    </main>
  );
}
