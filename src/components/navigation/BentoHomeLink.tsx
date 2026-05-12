"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MouseEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { resolveCurrentProfileHref } from "@/lib/profile-routes";

export default function BentoHomeLink() {
  const router = useRouter();
  const { loading, user } = useAuth();
  const [profileHref, setProfileHref] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const resolveHref = async () => {
      if (!user) {
        setProfileHref(null);
        return;
      }

      try {
        const resolvedHref = await resolveCurrentProfileHref(user.uid);

        if (isMounted) {
          setProfileHref(resolvedHref);
        }
      } catch (profileError) {
        console.warn("Could not resolve bento icon route", profileError);

        if (isMounted) {
          setProfileHref("/sign-up");
        }
      }
    };

    void resolveHref();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const href = user ? profileHref ?? "/" : "/";

  const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (!user || profileHref) {
      return;
    }

    event.preventDefault();

    try {
      const resolvedHref = await resolveCurrentProfileHref(user.uid);

      setProfileHref(resolvedHref);
      router.push(resolvedHref);
    } catch (profileError) {
      console.warn("Could not navigate with bento icon", profileError);
      router.push("/sign-up");
    }
  };

  return (
    <Link
      aria-label={user ? "Go to your Been-To-Box" : "Go to Been-To-Box home"}
      aria-busy={loading || Boolean(user && !profileHref)}
      href={href}
      className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#24110c]/15 bg-white/70 shadow-[0_8px_0_rgba(36,17,12,0.12)] transition-transform hover:-translate-y-0.5"
      onClick={handleClick}
    >
      <Image
        src="/icon.png"
        alt=""
        width={96}
        height={96}
        className="h-24 w-24 max-w-none rounded-[1.35rem] object-cover"
        priority
      />
    </Link>
  );
}
