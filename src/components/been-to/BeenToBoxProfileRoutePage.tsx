"use client";

import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import BeenToBoxPage from "@/components/been-to/BeenToBoxPage";
import BeenToBoxCityPage from "@/components/been-to/BeenToBoxCityPage";
import { db } from "@/lib/firebase";
import type { PublicBeenToBoxProfileData } from "@/lib/public-profiles";
import { validateUsername } from "@/lib/usernames";

type ProfileDoc = {
  displayName?: unknown;
  photoURL?: unknown;
  uid?: unknown;
  username?: unknown;
};

export default function BeenToBoxProfileRoutePage({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicBeenToBoxProfileData | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      const validation = validateUsername(slug);

      if (!validation.ok) {
        setLoading(false);
        return;
      }

      try {
        const [publicProfileSnapshot, usernameSnapshot] = await Promise.all([
          getDoc(doc(db, "publicProfiles", validation.username)),
          getDoc(doc(db, "usernames", validation.username)),
        ]);
        const publicProfile = publicProfileSnapshot.exists()
          ? (publicProfileSnapshot.data() as ProfileDoc)
          : {};
        const usernameProfile = usernameSnapshot.exists()
          ? (usernameSnapshot.data() as ProfileDoc)
          : {};
        const uid = getString(publicProfile.uid) ?? getString(usernameProfile.uid);

        if (!uid) {
          if (isMounted) {
            setProfile(null);
          }
          return;
        }

        if (isMounted) {
          setProfile({
            displayName:
              getString(publicProfile.displayName) ??
              getString(usernameProfile.displayName) ??
              validation.username,
            photoURL:
              getString(publicProfile.photoURL) ??
              getString(usernameProfile.photoURL) ??
              "",
            uid,
            username: validation.username,
          });
        }
      } catch (profileError) {
        console.error("Failed to load Been-To-Box public profile", profileError);

        if (isMounted) {
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) {
    return <BeenToBoxProfileLoader />;
  }

  if (!profile) {
    return <BeenToBoxCityPage locationSlug={slug} />;
  }

  return <BeenToBoxPage profile={profile} />;
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function BeenToBoxProfileLoader() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f8edcf] px-4 text-[#24110c]">
      <div className="rounded-[2rem] border-[8px] border-[#151313] bg-[#fff4cf] px-8 py-7 text-center shadow-[0_18px_0_rgba(36,17,12,0.16)]">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#8f1110]" />
        <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-[#8f1110]">
          Opening this Been-To-Box
        </p>
      </div>
    </main>
  );
}
