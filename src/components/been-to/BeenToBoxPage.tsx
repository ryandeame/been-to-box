"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Compass, Globe2, MapPin, Plane, Plus, Sparkles } from "lucide-react";

import {
  toBeenToDestinations,
  type BeenToDestination,
  type BeenToImageDimensions,
  type BeenToLocationWithImage,
  type BeenToStat,
} from "./beenToData";
import { useBeenToLocations } from "./useBeenToLocations";
import type { PublicBeenToBoxProfileData } from "@/lib/public-profiles";

const statStyles = [
  "from-teal-500 to-cyan-700",
  "from-orange-400 to-red-600",
  "from-violet-500 to-indigo-700",
  "from-lime-400 to-emerald-700",
];
const DIMENSION_CACHE_KEY = "been-to-box:image-dimensions:v2";
const IMAGE_MEASURE_TIMEOUT_MS = 3000;

function measureImage(src: string) {
  return new Promise<BeenToImageDimensions>((resolve, reject) => {
    const image = new window.Image();
    const timeout = window.setTimeout(() => {
      reject(new Error(`Timed out measuring image: ${src}`));
    }, IMAGE_MEASURE_TIMEOUT_MS);

    image.decoding = "async";
    image.onload = () => {
      window.clearTimeout(timeout);
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      resolve({
        height,
        ratio: width / height,
        width,
      });
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error(`Failed to load image: ${src}`));
    };
    image.src = src;
  });
}

function readDimensionCache() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawCache = window.sessionStorage.getItem(DIMENSION_CACHE_KEY);

    if (!rawCache) {
      return {};
    }

    const parsedCache = JSON.parse(rawCache);

    if (!parsedCache || typeof parsedCache !== "object") {
      return {};
    }

    return parsedCache as Record<string, BeenToImageDimensions>;
  } catch (cacheError) {
    console.warn("Failed to read Been-To-Box dimension cache", cacheError);
    return {};
  }
}

function writeDimensionCache(dimensionsByImage: Record<string, BeenToImageDimensions>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      DIMENSION_CACHE_KEY,
      JSON.stringify(dimensionsByImage),
    );
  } catch (cacheError) {
    console.warn("Failed to write Been-To-Box dimension cache", cacheError);
  }
}

function useMeasuredImageRows(locations: BeenToLocationWithImage[]) {
  const [dimensionsByImage, setDimensionsByImage] = useState<
    Record<string, BeenToImageDimensions>
  >({});
  const imageKey = useMemo(
    () => locations.map((location) => location.heroImage).join("|"),
    [locations],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDimensionsByImage(readDimensionCache());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const unmeasuredLocations = locations.filter(
      (location) => !dimensionsByImage[location.heroImage],
    );

    if (unmeasuredLocations.length === 0) {
      return;
    }

    const loadDimensions = async () => {
      try {
        const measuredEntries = await Promise.all(
          unmeasuredLocations.map(async (location) => {
            try {
              return [
                location.heroImage,
                await measureImage(location.heroImage),
              ] as const;
            } catch (measureError) {
              console.warn("Failed to measure Been-To-Box image", measureError);

              return [
                location.heroImage,
                {
                  height: 1,
                  ratio: 1,
                  width: 1,
                },
              ] as const;
            }
          }),
        );

        if (!isMounted) {
          return;
        }

        setDimensionsByImage((currentDimensions) => {
          const nextDimensions = {
            ...currentDimensions,
            ...Object.fromEntries(measuredEntries),
          };

          writeDimensionCache(nextDimensions);

          return nextDimensions;
        });
      } catch (measureError) {
        console.warn("Failed to measure Been-To-Box images", measureError);
      }
    };

    loadDimensions();

    return () => {
      isMounted = false;
    };
  }, [dimensionsByImage, imageKey, locations]);

  return {
    dimensionsByImage,
  };
}

function areImagesMeasured(
  locations: BeenToLocationWithImage[],
  dimensionsByImage: Record<string, BeenToImageDimensions>,
) {
  return locations.every((location) => Boolean(dimensionsByImage[location.heroImage]));
}

export default function BeenToBoxPage({
  profile,
}: {
  profile?: PublicBeenToBoxProfileData | null;
}) {
  const {
    archiveLocations,
    authReady,
    error,
    hasMore,
    initialLoading,
    isAuthenticated,
    isPublicPreview,
    loadingMore,
    loadMore,
    primaryLocations,
    stats,
  } = useBeenToLocations({ profile });
  const { dimensionsByImage: primaryDimensions } = useMeasuredImageRows(primaryLocations);
  const { dimensionsByImage: archiveDimensions } = useMeasuredImageRows(archiveLocations);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const scrollSentinelRef = useRef<HTMLDivElement | null>(null);
  const primaryDestinations = useMemo(
    () =>
      toBeenToDestinations(primaryLocations, {
        dimensionsByImage: primaryDimensions,
        primary: true,
      }),
    [primaryDimensions, primaryLocations],
  );
  const archiveDestinations = useMemo(
    () =>
      toBeenToDestinations(archiveLocations, {
        dimensionsByImage: archiveDimensions,
      }),
    [archiveDimensions, archiveLocations],
  );
  const hasPendingArchiveMeasurements = useMemo(
    () => !areImagesMeasured(archiveLocations, archiveDimensions),
    [archiveDimensions, archiveLocations],
  );
  const hasArchiveDestinations = archiveDestinations.length > 0;
  const profileHref = profile ? `/${profile.username}` : "/";

  useEffect(() => {
    const sentinel = scrollSentinelRef.current;

    if (!sentinel || initialLoading || error) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        if (!authReady || !isAuthenticated) {
          setShowAuthGate(true);
          return;
        }

        if (hasMore && !loadingMore) {
          loadMore();
        }
      },
      {
        rootMargin: "360px 0px",
      },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [
    authReady,
    error,
    hasMore,
    initialLoading,
    isAuthenticated,
    loadMore,
    loadingMore,
  ]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8edcf] text-[#24110c]">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#f97316]/25 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#14b8a6]/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#8b5cf6]/15 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen max-w-[1720px] flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[#24110c]/15 bg-white/55 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-[#24110c] shadow-[0_8px_0_rgba(36,17,12,0.12)] transition-transform hover:-translate-y-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Product
          </Link>
          <div className="rounded-full border-2 border-[#24110c]/10 bg-[#24110c] px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-[#f8edcf] shadow-[0_8px_0_rgba(36,17,12,0.12)]">
            Choose a flavor
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden rounded-[2.25rem] border-[10px] border-[#151313] bg-[#8f1110] p-3 shadow-[0_34px_80px_rgba(36,17,12,0.28)] transition-[padding,min-height] duration-700 ease-out sm:rounded-[3rem] sm:p-4 lg:p-5">
          <div className="pointer-events-none absolute inset-3 rounded-[1.75rem] border border-white/15 sm:inset-4 sm:rounded-[2.35rem]" />

          <div className="relative grid min-h-[1180px] gap-3 sm:gap-4 lg:min-h-0 lg:grid-cols-12 lg:auto-rows-[150px]">
            <HeroBanner profile={profile} />

            {initialLoading && primaryDestinations.length === 0 ? <LoadingCompartment /> : null}
            {error ? <ErrorCompartment message={error} /> : null}

            {!initialLoading && !error && primaryDestinations.length === 0 ? (
              <ErrorCompartment message="No Been-To-Box locations have images yet." />
            ) : null}

            {!initialLoading && !error && primaryDestinations.map((destination, index) => (
              <DestinationCompartment
                key={destination.name}
                destination={destination}
                index={index}
                profileUsername={profile?.username}
                canOpenGallery={!isPublicPreview}
              />
            ))}

            <IndicatorRail loading={initialLoading && primaryDestinations.length === 0} stats={stats} />
          </div>

          {archiveDestinations.length > 0 ? (
            <div className="relative mt-3 grid animate-[been-to-compartment-row-in_520ms_cubic-bezier(0.22,1,0.36,1)_both] gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-12 lg:auto-rows-[150px]">
              {archiveDestinations.map((destination, index) => (
                <DestinationCompartment
                  key={destination.name}
                  destination={destination}
                  index={primaryDestinations.length + index}
                  profileUsername={profile?.username}
                  canOpenGallery={!isPublicPreview}
                />
              ))}
            </div>
          ) : null}

          {isPublicPreview && primaryDestinations.length + archiveDestinations.length >= 10 ? (
            <LockedPreviewRemainder profile={profile} />
          ) : null}
        </div>

        <div className="min-h-10">
          {loadingMore || hasPendingArchiveMeasurements ? <ScrollLoader /> : null}
        </div>

        <div ref={scrollSentinelRef} className="h-10" />

        {authReady && !isAuthenticated && showAuthGate && !isPublicPreview ? (
          <AuthScrollGate redirectHref={profileHref} />
        ) : null}

        {authReady && isAuthenticated && !hasMore && hasArchiveDestinations ? (
          <div className="mx-auto mt-8 rounded-full border-2 border-[#24110c]/15 bg-white/55 px-5 py-3 text-center text-sm font-black uppercase tracking-[0.18em] text-[#24110c]/70 shadow-[0_8px_0_rgba(36,17,12,0.1)]">
            Every compartment is on the table
          </div>
        ) : null}
      </section>

      {authReady && isAuthenticated ? (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {addMenuOpen ? (
            <div className="rounded-[1.5rem] border-2 border-[#24110c]/15 bg-[#fff4cf] p-2 shadow-[0_18px_44px_rgba(36,17,12,0.22)]">
              <Link
                className="block rounded-2xl bg-[#24110c] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#fff4cf] transition-transform hover:-translate-y-0.5"
                href="/add-photo"
              >
                Add Photos
              </Link>
            </div>
          ) : null}
          <button
            aria-expanded={addMenuOpen}
            aria-label="Open Been-To-Box actions"
            className="grid h-16 w-16 place-items-center rounded-full border-[5px] border-[#fff4cf] bg-[#f97316] text-white shadow-[0_12px_0_rgba(36,17,12,0.22)] transition-transform hover:-translate-y-1"
            onClick={() => setAddMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            <Plus className={`h-8 w-8 transition-transform ${addMenuOpen ? "rotate-45" : ""}`} />
          </button>
        </div>
      ) : null}
    </main>
  );
}

function HeroBanner({ profile }: { profile?: PublicBeenToBoxProfileData | null }) {
  return (
    <article className="group relative isolate min-h-[300px] overflow-hidden rounded-[1.75rem] border-2 border-[#151313]/80 bg-[#061329] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.08),0_14px_0_rgba(21,19,19,0.18)] lg:col-start-1 lg:col-span-7 lg:row-start-1 lg:row-span-2">
      <Image
        src="/been-to/been-to-box-banner.png"
        alt=""
        fill
        priority
        sizes="(min-width: 1024px) 58vw, 100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#061329]/95 via-[#061329]/68 to-[#061329]/5" />
      <div className="absolute inset-x-5 top-5 flex items-center justify-between gap-4">
        <div className="rounded-full border border-[#f8edcf]/25 bg-[#f8edcf]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#f8edcf] backdrop-blur">
          Memories collected
        </div>
        <div className="hidden rounded-full border border-[#14b8a6]/45 bg-[#14b8a6]/20 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#c8fff4] backdrop-blur sm:inline-flex">
          Adventure awaits
        </div>
      </div>
      <div className="absolute bottom-6 left-5 max-w-2xl sm:left-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#facc15] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#24110c] shadow-[0_6px_0_rgba(0,0,0,0.24)]">
          <Plane className="h-4 w-4" />
          {profile ? `@${profile.username}` : "World archive"}
        </div>
        <h1 className="text-5xl font-black leading-[0.9] tracking-tight text-[#f8edcf] drop-shadow-[0_5px_0_rgba(0,0,0,0.35)] sm:text-7xl lg:text-8xl">
          Been-To-Box
        </h1>
        <p className="mt-4 max-w-xl text-xl font-bold leading-8 text-[#f8edcf]/90 sm:text-2xl">
          {profile
            ? `${profile.displayName}'s world, plated one place at a time.`
            : "Open the world you have lived."}
        </p>
      </div>
    </article>
  );
}

function DestinationCompartment({
  canOpenGallery = true,
  destination,
  index,
  profileUsername,
}: {
  canOpenGallery?: boolean;
  destination: BeenToDestination;
  index: number;
  profileUsername?: string;
}) {
  const Icon = destination.icon;

  const content = (
    <>
      <Image
        src={destination.image}
        alt={`${destination.name}, ${destination.country}`}
        fill
        sizes="(min-width: 1024px) 33vw, 100vw"
        className="object-cover transition-transform duration-700 group-hover:scale-105"
        style={{ objectPosition: destination.objectPosition }}
        unoptimized={destination.image.startsWith("http")}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1d0806]/92 via-[#1d0806]/22 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_28%)] opacity-80" />

      <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap items-start gap-2">
        <div
          className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#f8edcf] px-3 py-2 text-xl font-black text-[#f8edcf] shadow-[0_5px_0_rgba(0,0,0,0.25)]"
          style={{ backgroundColor: destination.accent }}
        >
          <Icon className="h-5 w-5" />
          {destination.name}
        </div>
        <div className="rounded-xl border-2 border-[#24110c]/20 bg-[#fff4cf] px-3 py-1.5 text-sm font-black text-[#8f1110] shadow-[0_4px_0_rgba(0,0,0,0.18)]">
          {destination.flavor}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
        <div className="rounded-full border border-white/20 bg-black/45 px-3 py-2 text-sm font-bold text-white backdrop-blur-md">
          <MapPin className="mr-1 inline h-4 w-4" />
          {destination.country}
        </div>
        <div className="rounded-full border border-white/20 bg-white/15 px-3 py-2 text-sm font-black text-white backdrop-blur-md">
          {destination.photoCount} photos
        </div>
      </div>
    </>
  );

  const animationDelay = `${index * 90}ms`;
  const className = `group relative isolate min-h-[260px] animate-[been-to-card-in_560ms_cubic-bezier(0.22,1,0.36,1)_both] overflow-hidden rounded-[1.65rem] border-2 border-[#151313]/75 bg-[#24110c] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.08),0_12px_0_rgba(21,19,19,0.16)] transition-transform duration-300 hover:-translate-y-1 ${destination.layoutClass}`;

  const href = profileUsername && destination.slug
    ? `/${profileUsername}/${destination.slug}`
    : destination.slug
      ? `/${destination.slug}`
      : null;

  if (href && canOpenGallery) {
    return (
      <Link
        href={href}
        className={className}
        style={{ borderColor: destination.accent, animationDelay }}
      >
        {content}
      </Link>
    );
  }

  return (
    <article
      className={className}
      style={{ borderColor: destination.accent, animationDelay }}
    >
      {content}
    </article>
  );
}

function LockedPreviewRemainder({
  profile,
}: {
  profile?: PublicBeenToBoxProfileData | null;
}) {
  const redirectHref = profile ? `/${profile.username}` : "/";

  return (
    <div className="relative mt-3 overflow-hidden rounded-[1.75rem] border-2 border-[#151313]/75 bg-[#24110c] p-3 shadow-[inset_0_0_0_4px_rgba(255,255,255,0.08),0_12px_0_rgba(21,19,19,0.16)] sm:mt-4 sm:p-4">
      <div className="grid min-h-[360px] gap-3 blur-md sm:gap-4 lg:grid-cols-12 lg:auto-rows-[150px]">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className={`rounded-[1.65rem] border-2 border-[#f8edcf]/40 bg-gradient-to-br ${
              item % 3 === 0
                ? "from-[#f97316] to-[#8b5cf6]"
                : item % 3 === 1
                  ? "from-[#14b8a6] to-[#facc15]"
                  : "from-[#ef4444] to-[#061329]"
            } ${item < 2 ? "lg:col-span-6" : "lg:col-span-3"} lg:row-span-2`}
          />
        ))}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-[#24110c]/35 p-6 backdrop-blur-[2px]">
        <div className="max-w-xl rounded-[2rem] border-[6px] border-[#151313] bg-[#fff4cf] p-6 text-center shadow-[0_16px_0_rgba(21,19,19,0.22)]">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#8f1110]/75">
            More compartments are packed
          </p>
          <h2 className="mt-3 text-3xl font-black text-[#24110c] sm:text-4xl">
            Log in to reveal the rest of this Been-To-Box.
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              className="rounded-full bg-[#24110c] px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#f8edcf] shadow-[0_7px_0_rgba(36,17,12,0.22)]"
              href={`/sign-in?redirect=${encodeURIComponent(redirectHref)}`}
            >
              Log in
            </Link>
            <Link
              className="rounded-full border-2 border-[#24110c]/20 bg-[#f97316] px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_7px_0_rgba(36,17,12,0.18)]"
              href={`/sign-up?redirect=${encodeURIComponent(redirectHref)}`}
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingCompartment() {
  return (
    <div className="relative isolate grid min-h-[520px] place-items-center overflow-hidden rounded-[1.65rem] border-2 border-[#151313]/75 bg-[#fff4cf] p-8 text-center shadow-[inset_0_0_0_4px_rgba(255,255,255,0.08),0_12px_0_rgba(21,19,19,0.16)] lg:col-start-1 lg:col-span-10 lg:row-start-3 lg:row-span-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(249,115,22,0.18),transparent_32%),radial-gradient(circle_at_78%_70%,rgba(20,184,166,0.2),transparent_34%)]" />
      <div className="absolute left-8 top-8 h-24 w-24 animate-[been-to-float_4.8s_ease-in-out_infinite] rounded-full border-[10px] border-[#8f1110]/15 bg-[#facc15]/35" />
      <div className="absolute bottom-8 right-10 h-32 w-32 animate-[been-to-float_5.4s_ease-in-out_infinite_reverse] rounded-full border-[12px] border-[#14b8a6]/20 bg-[#8b5cf6]/15" />

      <div className="relative">
        <CircleLoader />
        <p className="mt-8 text-3xl font-black">Packing the first five boxes...</p>
        <p className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-[#8f1110]/70">
          Fetching locations, sorting first images, plating the bento
        </p>
      </div>
    </div>
  );
}

function ScrollLoader() {
  return (
    <div className="mx-auto mt-8 grid max-w-md place-items-center rounded-[2rem] border-2 border-[#151313]/75 bg-[#fff4cf] px-8 py-7 text-center shadow-[0_14px_0_rgba(21,19,19,0.16)]">
      <div className="scale-75">
        <CircleLoader />
      </div>
      <p className="-mt-3 text-xl font-black">Plating five more locations...</p>
    </div>
  );
}

function AuthScrollGate({ redirectHref }: { redirectHref: string }) {
  return (
    <section className="mx-auto mt-8 max-w-3xl rounded-[2.25rem] border-[6px] border-[#151313] bg-[#fff4cf] p-7 text-center shadow-[0_18px_0_rgba(36,17,12,0.16)]">
      <div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full border-[8px] border-[#8f1110] bg-[#facc15]">
        <Compass className="h-10 w-10 text-[#24110c]" />
      </div>
      <p className="text-sm font-black uppercase tracking-[0.22em] text-[#8f1110]/70">
        More compartments are ready
      </p>
      <h2 className="mt-3 text-4xl font-black text-[#24110c]">
        Create an account or log in to keep scrolling.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-lg font-bold leading-8 text-[#8f1110]/75">
        The first five destinations are open for preview. The rest of the Been-To-Box is reserved for authenticated travelers.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link
          className="rounded-full bg-[#24110c] px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#f8edcf] shadow-[0_7px_0_rgba(36,17,12,0.22)]"
          href={`/sign-in?redirect=${encodeURIComponent(redirectHref)}`}
        >
          Log in
        </Link>
        <Link
          className="rounded-full border-2 border-[#24110c]/20 bg-[#f97316] px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_7px_0_rgba(36,17,12,0.18)]"
          href={`/sign-up?redirect=${encodeURIComponent(redirectHref)}`}
        >
          Create account
        </Link>
      </div>
    </section>
  );
}

function CircleLoader() {
  return (
    <div className="relative mx-auto h-44 w-44">
      <div className="absolute inset-0 rounded-full border-[14px] border-[#24110c]/10" />
      <div className="absolute inset-0 animate-[been-to-spin_1.3s_linear_infinite] rounded-full border-[14px] border-transparent border-t-[#8f1110] border-r-[#f97316]" />
      <div className="absolute inset-5 animate-[been-to-spin_1.9s_linear_infinite_reverse] rounded-full border-[10px] border-transparent border-b-[#14b8a6] border-l-[#8b5cf6]" />
      <div className="absolute inset-12 animate-[been-to-pulse-ring_1.6s_ease-in-out_infinite] rounded-full bg-[#24110c] shadow-[0_0_0_10px_rgba(36,17,12,0.08)]" />
      <div className="absolute inset-0 grid place-items-center">
        <Sparkles className="h-10 w-10 animate-pulse text-[#f8edcf]" />
      </div>
      {[0, 1, 2, 3, 4].map((dot) => (
        <span
          key={dot}
          className="absolute left-1/2 top-1/2 h-3 w-3 origin-[0_0] animate-[been-to-orbit_2.4s_linear_infinite] rounded-full bg-[#f97316] shadow-[0_0_18px_rgba(249,115,22,0.8)]"
          style={{
            animationDelay: `${dot * -0.18}s`,
            transform: `rotate(${dot * 72}deg) translateX(5.7rem)`,
          }}
        />
      ))}
    </div>
  );
}

function ErrorCompartment({ message }: { message: string }) {
  return (
    <div className="grid min-h-[520px] place-items-center rounded-[1.65rem] border-2 border-[#151313]/75 bg-[#fff4cf] p-8 text-center shadow-[inset_0_0_0_4px_rgba(255,255,255,0.08),0_12px_0_rgba(21,19,19,0.16)] lg:col-start-1 lg:col-span-10 lg:row-start-3 lg:row-span-4">
      <div>
        <Compass className="mx-auto mb-4 h-10 w-10 text-[#8f1110]" />
        <p className="text-3xl font-black">The box is not packed yet.</p>
        <p className="mt-3 max-w-xl text-lg font-bold text-[#8f1110]/75">
          {message}
        </p>
      </div>
    </div>
  );
}

function IndicatorRail({ loading, stats }: { loading: boolean; stats: BeenToStat[] }) {
  return (
    <aside className="grid gap-3 rounded-[1.75rem] border-2 border-[#151313]/75 bg-[#7c0d0c] p-3 shadow-[inset_0_0_0_4px_rgba(255,255,255,0.08),0_12px_0_rgba(21,19,19,0.16)] sm:grid-cols-2 lg:col-start-11 lg:col-span-2 lg:row-start-1 lg:row-span-6 lg:grid-cols-1">
      <div className="rounded-[1.35rem] border-2 border-[#f8edcf]/40 bg-[#f8edcf] p-4 text-center text-[#24110c] shadow-[0_7px_0_rgba(21,19,19,0.2)]">
        <Compass className="mx-auto mb-2 h-7 w-7 text-[#8f1110]" />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8f1110]">
          Box stats
        </p>
      </div>

      {(loading ? buildLoadingStats() : stats).map((stat, index) => (
        <div
          key={stat.label}
          className={`flex min-h-[138px] flex-col items-center justify-center rounded-full border-[6px] border-[#f8edcf] bg-gradient-to-br ${statStyles[index]} p-5 text-center text-white shadow-[inset_0_0_0_3px_rgba(255,255,255,0.2),0_8px_0_rgba(21,19,19,0.22)] ${loading ? "animate-[been-to-stat-bob_1.8s_ease-in-out_infinite]" : "animate-[been-to-card-in_520ms_cubic-bezier(0.22,1,0.36,1)_both]"}`}
          style={{
            animationDelay: `${index * 100}ms`,
          }}
        >
          <Globe2 className="mb-2 h-7 w-7" />
          <span className="text-5xl font-black leading-none">{stat.value}</span>
          <span className="mt-2 text-sm font-black uppercase tracking-[0.12em]">
            {stat.label}
          </span>
        </div>
      ))}
    </aside>
  );
}

function buildLoadingStats(): BeenToStat[] {
  return [
    { label: "places", value: 0 },
    { label: "countries", value: 0 },
    { label: "continents", value: 0 },
    { label: "photos", value: 0 },
  ];
}
