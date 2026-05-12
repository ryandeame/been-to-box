"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { resolveCurrentProfileHref } from "@/lib/profile-routes";

export default function BeenToBoxSplashPage() {
  const router = useRouter();
  const { loading, user } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const redirectToProfile = async () => {
      if (loading || !user) {
        return;
      }

      setRedirecting(true);

      const profileHref = await resolveCurrentProfileHref(user.uid);

      if (isMounted) {
        router.replace(profileHref);
      }
    };

    void redirectToProfile();

    return () => {
      isMounted = false;
    };
  }, [loading, router, user]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061329] text-[#f8edcf]">
      <Image
        src="/been-to/been-to-box-splash.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#061329]/96 via-[#061329]/78 to-[#061329]/12" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(249,115,22,0.22),transparent_26%),radial-gradient(circle_at_28%_82%,rgba(20,184,166,0.18),transparent_28%)]" />

      <section className="relative z-10 flex min-h-screen items-center px-5 py-10 sm:px-8 lg:px-14">
        <div className="max-w-3xl">
          <div className="inline-flex items-center rounded-full border border-[#f8edcf]/20 bg-[#f8edcf]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#facc15] shadow-[0_8px_0_rgba(0,0,0,0.2)] backdrop-blur">
            Travel, plated
          </div>

          <h1 className="mt-7 text-6xl font-black leading-[0.86] tracking-tight text-[#f8edcf] drop-shadow-[0_8px_0_rgba(0,0,0,0.28)] sm:text-8xl lg:text-9xl">
            Been-To-Box
          </h1>
          <p className="mt-6 max-w-2xl text-xl font-bold leading-8 text-[#f8edcf]/88 sm:text-2xl sm:leading-9">
            Turn the places you have lived, wandered, and wondered through into a colorful travel bento that is easy to share.
          </p>

          {loading || redirecting ? (
            <div className="mt-9 inline-flex items-center gap-3 rounded-full border border-[#f8edcf]/20 bg-[#f8edcf]/10 px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#f8edcf] backdrop-blur">
              <Loader2 className="h-5 w-5 animate-spin text-[#facc15]" />
              Opening your box
            </div>
          ) : (
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                className="inline-flex items-center gap-2 rounded-full bg-[#facc15] px-7 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#24110c] shadow-[0_9px_0_rgba(0,0,0,0.28)] transition-transform hover:-translate-y-1"
                href="/sign-up"
              >
                Sign up
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex items-center gap-2 rounded-full border-2 border-[#f8edcf]/45 bg-[#f8edcf]/10 px-7 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#f8edcf] shadow-[0_9px_0_rgba(0,0,0,0.18)] backdrop-blur transition-transform hover:-translate-y-1"
                href="/sign-in"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
