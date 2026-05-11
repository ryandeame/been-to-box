import Link from "next/link";
import { Camera, Globe2, MapPin } from "lucide-react";

export type PublicBeenToBoxProfileData = {
  displayName: string;
  photoURL: string;
  uid: string;
  username: string;
};

export default function PublicBeenToBoxProfile({
  profile,
}: {
  profile: PublicBeenToBoxProfileData;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8edcf] px-4 py-6 text-[#24110c] sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#f97316]/30 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#14b8a6]/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#8b5cf6]/20 blur-3xl" />
      </div>

      <section className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-5xl place-items-center">
        <div className="w-full rounded-[2.75rem] border-[10px] border-[#151313] bg-[#8f1110] p-3 shadow-[0_34px_80px_rgba(36,17,12,0.28)]">
          <div className="overflow-hidden rounded-[2rem] bg-[#fff4cf]">
            <div className="relative min-h-[340px] bg-[#061329] p-8 text-[#f8edcf]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.34),transparent_32%),radial-gradient(circle_at_78%_70%,rgba(20,184,166,0.3),transparent_34%)]" />
              <div className="relative">
                <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full border-[8px] border-[#facc15] bg-[#f8edcf] text-[#8f1110] shadow-[0_10px_0_rgba(0,0,0,0.22)]">
                  {profile.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={profile.photoURL}
                    />
                  ) : (
                    <Globe2 className="h-12 w-12" />
                  )}
                </div>
                <p className="mt-8 inline-flex rounded-full bg-[#facc15] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#24110c] shadow-[0_6px_0_rgba(0,0,0,0.24)]">
                  @{profile.username}
                </p>
                <h1 className="mt-4 text-5xl font-black leading-none tracking-tight sm:text-7xl">
                  {profile.displayName}
                </h1>
                <p className="mt-5 max-w-2xl text-xl font-bold leading-8 text-[#f8edcf]/88">
                  A Been-To-Box traveler collecting places, photos, and stories from around the world.
                </p>
              </div>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
              <div className="rounded-[1.5rem] border-2 border-[#24110c]/15 bg-[#f8edcf] p-5 shadow-[0_8px_0_rgba(36,17,12,0.1)]">
                <MapPin className="mb-3 h-7 w-7 text-[#8f1110]" />
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#8f1110]">
                  Places
                </p>
                <p className="mt-2 text-3xl font-black">Growing</p>
              </div>
              <div className="rounded-[1.5rem] border-2 border-[#24110c]/15 bg-[#f8edcf] p-5 shadow-[0_8px_0_rgba(36,17,12,0.1)]">
                <Camera className="mb-3 h-7 w-7 text-[#8f1110]" />
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#8f1110]">
                  Photos
                </p>
                <p className="mt-2 text-3xl font-black">Shared soon</p>
              </div>
              <div className="rounded-[1.5rem] border-2 border-[#24110c]/15 bg-[#f8edcf] p-5 shadow-[0_8px_0_rgba(36,17,12,0.1)]">
                <Globe2 className="mb-3 h-7 w-7 text-[#8f1110]" />
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#8f1110]">
                  Profile
                </p>
                <p className="mt-2 text-3xl font-black">Public</p>
              </div>
            </div>

            <div className="px-6 pb-8 sm:px-8">
              <Link
                className="inline-flex rounded-full bg-[#24110c] px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#fff4cf] shadow-[0_7px_0_rgba(36,17,12,0.22)]"
                href="/"
              >
                Open Been-To-Box
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
