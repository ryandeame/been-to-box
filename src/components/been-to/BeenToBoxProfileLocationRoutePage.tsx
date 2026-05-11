"use client";

import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import BeenToBoxCityPage from "@/components/been-to/BeenToBoxCityPage";
import { db } from "@/lib/firebase";
import { validateUsername } from "@/lib/usernames";

type ProfileDoc = {
  uid?: unknown;
};

export default function BeenToBoxProfileLocationRoutePage({
  locationSlug,
  slug,
}: {
  locationSlug: string;
  slug: string;
}) {
  const [loading, setLoading] = useState(true);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const validation = validateUsername(slug);
  const username = validation.ok ? validation.username : slug;

  useEffect(() => {
    let isMounted = true;

    const loadProfileUid = async () => {
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

        if (isMounted) {
          setProfileUid(uid);
        }
      } catch (profileError) {
        console.error("Failed to load Been-To-Box profile location", profileError);

        if (isMounted) {
          setProfileUid(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadProfileUid();

    return () => {
      isMounted = false;
    };
  }, [validation.ok, validation.username]);

  if (loading) {
    return <BeenToBoxLocationLoader />;
  }

  if (!profileUid) {
    return <BeenToBoxCityPage locationSlug={locationSlug} />;
  }

  return (
    <BeenToBoxCityPage
      backHref={`/${username}`}
      locationSlug={locationSlug}
      profileUid={profileUid}
    />
  );
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function BeenToBoxLocationLoader() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f8edcf] px-4 text-[#24110c]">
      <div className="rounded-[2rem] border-[8px] border-[#151313] bg-[#fff4cf] px-8 py-7 text-center shadow-[0_18px_0_rgba(36,17,12,0.16)]">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#8f1110]" />
        <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-[#8f1110]">
          Opening this gallery
        </p>
      </div>
    </main>
  );
}
