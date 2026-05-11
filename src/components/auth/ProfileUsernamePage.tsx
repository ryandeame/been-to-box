"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, Check, Copy, Loader2, UserRound } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/lib/firebase";
import { normalizeUsername, validateUsername } from "@/lib/usernames";

type ProfilePayload = {
  displayName: string;
  email: string;
  photoURL: string;
  publicUrl: string;
  username: string;
};

async function loadProfileFromFirestore(user: User): Promise<ProfilePayload | null> {
  const profileSnapshot = await getDoc(doc(db, "users", user.uid));

  if (!profileSnapshot.exists()) {
    return null;
  }

  const data = profileSnapshot.data();
  const username = typeof data.username === "string" ? data.username : "";

  return {
    displayName:
      typeof data.displayName === "string" ? data.displayName : user.displayName ?? "",
    email: typeof data.email === "string" ? data.email : user.email ?? "",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : user.photoURL ?? "",
    publicUrl: username ? `${window.location.origin}/${username}` : "",
    username,
  };
}

async function saveUsernameWithClientTransaction(
  user: User,
  username: string,
  siteOrigin: string,
) {
  const userRef = doc(db, "users", user.uid);
  const usernameRef = doc(db, "usernames", username);
  const publicProfileRef = doc(db, "publicProfiles", username);

  await runTransaction(db, async (transaction) => {
    const [userSnapshot, usernameSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(usernameRef),
    ]);
    const claimedByUid = usernameSnapshot.exists()
      ? usernameSnapshot.data()?.uid
      : null;

    if (claimedByUid && claimedByUid !== user.uid) {
      throw new Error("That username is already taken.");
    }

    const previousUsername = userSnapshot.exists()
      ? userSnapshot.data()?.username
      : null;

    if (
      typeof previousUsername === "string" &&
      previousUsername &&
      previousUsername !== username
    ) {
      transaction.delete(doc(db, "usernames", previousUsername));
    }

    transaction.set(
      usernameRef,
      {
        displayName: user.displayName ?? "",
        photoURL: user.photoURL ?? "",
        uid: user.uid,
        updatedAt: serverTimestamp(),
        username,
      },
      { merge: true },
    );
    transaction.set(
      userRef,
      {
        displayName: user.displayName ?? "",
        email: user.email ?? "",
        photoURL: user.photoURL ?? "",
        uid: user.uid,
        updatedAt: serverTimestamp(),
        username,
        usernameUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    transaction.set(
      publicProfileRef,
      {
        displayName: user.displayName ?? username,
        photoURL: user.photoURL ?? "",
        uid: user.uid,
        updatedAt: serverTimestamp(),
        username,
      },
      { merge: true },
    );
  });

  return {
    publicUrl: `${siteOrigin}/${username}`,
    username,
  };
}

export default function ProfileUsernamePage() {
  const { loading: authLoading, user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState("https://been-to-box.example");
  const [username, setUsername] = useState("");
  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  const previewUrl = normalizedUsername ? `${siteOrigin}/${normalizedUsername}` : "";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSiteOrigin(window.location.origin);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (authLoading) {
        return;
      }

      if (!user) {
        setLoadingProfile(false);
        return;
      }

      try {
        setLoadingProfile(true);
        const profilePayload = await loadProfileFromFirestore(user);

        if (!profilePayload) {
          throw new Error("Could not load profile.");
        }

        if (isMounted) {
          setProfile(profilePayload);
          setUsername(profilePayload.username ?? "");
        }
      } catch (profileError) {
        if (isMounted) {
          setMessage(
            profileError instanceof Error
              ? profileError.message
              : "Could not load profile.",
          );
        }
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [authLoading, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCopied(false);
    setMessage("");

    const validation = validateUsername(username);

    if (!validation.ok) {
      setMessage(validation.reason);
      return;
    }

    try {
      setSaving(true);
      if (!user) {
        throw new Error("Sign in to save a username.");
      }

      const savedProfile = await saveUsernameWithClientTransaction(
        user,
        validation.username,
        siteOrigin,
      );

      setProfile((currentProfile) => ({
        displayName: currentProfile?.displayName ?? user?.displayName ?? "",
        email: currentProfile?.email ?? user?.email ?? "",
        photoURL: currentProfile?.photoURL ?? user?.photoURL ?? "",
        publicUrl: savedProfile.publicUrl,
        username: savedProfile.username,
      }));
      setUsername(savedProfile.username);
      setMessage("Username saved. Your profile link is ready to share.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Could not save username.");
    } finally {
      setSaving(false);
    }
  };

  const copyProfileUrl = async () => {
    const url = profile?.publicUrl || previewUrl;

    if (!url) {
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  if (authLoading || loadingProfile) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8edcf] text-[#24110c]">
        <div className="flex items-center gap-3 rounded-full bg-[#24110c] px-5 py-3 font-black text-[#fff4cf]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading profile...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8edcf] px-4 text-[#24110c]">
        <section className="max-w-xl rounded-[2rem] border-[8px] border-[#151313] bg-[#fff4cf] p-8 text-center shadow-[0_18px_0_rgba(36,17,12,0.16)]">
          <UserRound className="mx-auto h-12 w-12 text-[#8f1110]" />
          <h1 className="mt-4 text-4xl font-black">Sign in to claim a username.</h1>
          <p className="mt-3 text-lg font-bold text-[#8f1110]/75">
            Your username becomes the final part of your shareable profile URL.
          </p>
          <Link
            className="mt-6 inline-flex rounded-full bg-[#24110c] px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#fff4cf]"
            href="/sign-in?redirect=/profile"
          >
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8edcf] px-4 py-6 text-[#24110c] sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#f97316]/30 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#14b8a6]/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#8b5cf6]/20 blur-3xl" />
      </div>

      <section className="relative mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border-2 border-[#24110c]/15 bg-white/55 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-[#24110c] shadow-[0_8px_0_rgba(36,17,12,0.12)] transition-transform hover:-translate-y-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to box
        </Link>

        <div className="mt-6 rounded-[2.75rem] border-[10px] border-[#151313] bg-[#8f1110] p-3 shadow-[0_34px_80px_rgba(36,17,12,0.28)]">
          <div className="rounded-[2rem] bg-[#fff4cf] p-6 sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#8f1110]">
              Public profile
            </p>
            <h1 className="mt-3 text-5xl font-black leading-none sm:text-7xl">
              Claim your username.
            </h1>
            <p className="mt-4 max-w-2xl text-lg font-bold leading-8 text-[#8f1110]/75">
              This gives you a shareable URL like <span className="text-[#24110c]">/{profile?.username || "your-name"}</span>.
            </p>

            <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
              <label className="grid gap-2">
                <span className="text-sm font-black uppercase tracking-[0.16em]">
                  Username
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-lg font-black text-[#8f1110]">
                    @
                  </span>
                  <input
                    className="w-full rounded-[1.35rem] border-[3px] border-[#24110c] bg-[#f8edcf] px-5 py-4 pl-11 text-lg font-black outline-none shadow-[inset_0_-5px_0_rgba(36,17,12,0.08),0_7px_0_rgba(36,17,12,0.16)] transition-transform focus:-translate-y-0.5 focus:border-[#8f1110]"
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="ryan-deame"
                    value={username}
                  />
                </div>
              </label>

              {previewUrl ? (
                <div className="rounded-[1.5rem] border-2 border-[#24110c]/15 bg-[#f8edcf] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8f1110]">
                    Share link
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <Link
                      className="break-all text-lg font-black text-[#24110c] underline decoration-[#f97316] decoration-4 underline-offset-4"
                      href={`/${normalizedUsername}`}
                    >
                      {profile?.publicUrl || previewUrl}
                    </Link>
                    <button
                      className="inline-flex items-center gap-2 rounded-full bg-[#14b8a6] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#06251f]"
                      onClick={copyProfileUrl}
                      type="button"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              ) : null}

              {message ? (
                <p className="rounded-2xl bg-[#24110c] px-4 py-3 font-bold text-[#fff4cf]">
                  {message}
                </p>
              ) : null}

              <button
                className="rounded-full bg-[#8f1110] px-7 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#fff4cf] shadow-[0_9px_0_rgba(36,17,12,0.22)] disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                {saving ? "Saving..." : "Save username"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
