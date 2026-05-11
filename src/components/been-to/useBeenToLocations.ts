"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { auth, db } from "@/lib/firebase";

import {
  buildBeenToStats,
  type BeenToLocation,
  type BeenToLocationWithImage,
} from "./beenToData";
import type { PublicBeenToBoxProfileData } from "@/lib/public-profiles";

const PAGE_SIZE = 5;
const PUBLIC_PREVIEW_SIZE = 10;
const CACHE_KEY = "been-to-box:locations-cache:v1";
const METADATA_COLLECTION = "appMetadata";
const METADATA_DOC_ID = "beenToBox";

type ImageDoc = {
  downloadURL?: unknown;
  imageDate?: unknown;
};

type PublicTopImageDoc = {
  downloadURL?: unknown;
  height?: unknown;
  imageId?: unknown;
  imageCount?: unknown;
  locationCountry?: unknown;
  locationId?: unknown;
  locationName?: unknown;
  locationSlug?: unknown;
  photoCount?: unknown;
  rank?: unknown;
  storagePath?: unknown;
  width?: unknown;
};

type BentoInfoDoc = {
  coverImageUrl?: string | null;
  imageCount?: number | null;
};

type BaseBeenToLocation = Omit<BeenToLocation, "heroImage" | "photoCount">;
type UseBeenToLocationsOptions = {
  profile?: PublicBeenToBoxProfileData | null;
};
type BeenToCachePayload = {
  cachedAt: number;
  cursorId: string | null;
  hasMore: boolean;
  locations: BeenToLocationWithImage[];
  version: string;
};

function sortImagesByDate(imageDocs: ImageDoc[]) {
  return [...imageDocs].sort((a, b) => {
    const aSeconds = getImageDateSeconds(a.imageDate);
    const bSeconds = getImageDateSeconds(b.imageDate);

    return aSeconds - bSeconds;
  });
}

function getImageDateSeconds(value: unknown) {
  if (typeof value === "object" && value && "seconds" in value) {
    return Number((value as { seconds?: number }).seconds ?? 0);
  }

  return 0;
}

function hasHeroImage(location: BeenToLocation): location is BeenToLocationWithImage {
  return typeof location.heroImage === "string" && location.heroImage.length > 0;
}

function serializeVersion(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "object" && value && "seconds" in value) {
    const timestamp = value as { nanoseconds?: number; seconds?: number };
    return `${timestamp.seconds ?? 0}:${timestamp.nanoseconds ?? 0}`;
  }

  return null;
}

function isPermissionDeniedError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "permission-denied"
  );
}

async function fetchLocationsVersion() {
  const metadataSnapshot = await getDoc(doc(db, METADATA_COLLECTION, METADATA_DOC_ID));

  if (!metadataSnapshot.exists()) {
    return null;
  }

  const metadata = metadataSnapshot.data();

  return (
    serializeVersion(metadata.locationsVersion) ??
    serializeVersion(metadata.version) ??
    serializeVersion(metadata.locationsUpdatedAt) ??
    serializeVersion(metadata.updatedAt)
  );
}

function readLocationsCache(version: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawCache = window.localStorage.getItem(CACHE_KEY);

    if (!rawCache) {
      return null;
    }

    const cache = JSON.parse(rawCache) as Partial<BeenToCachePayload>;

    if (
      cache.version !== version ||
      !Array.isArray(cache.locations) ||
      cache.locations.length === 0 ||
      typeof cache.hasMore !== "boolean"
    ) {
      return null;
    }

    return cache as BeenToCachePayload;
  } catch (cacheError) {
    console.warn("Failed to read Been-To-Box cache", cacheError);
    return null;
  }
}

function writeLocationsCache(cache: BeenToCachePayload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (cacheError) {
    console.warn("Failed to write Been-To-Box cache", cacheError);
  }
}

async function enrichLocation(
  location: BaseBeenToLocation,
  bentoInfo: BentoInfoDoc | undefined,
  profileUid: string | null,
): Promise<BeenToLocation> {
  const imageSnapshot = await getDocs(
    getLocationImagesCollection(profileUid, location.id),
  );
  const imageDocs = imageSnapshot.docs.map((doc) => doc.data() as ImageDoc);
  const sortedImages = sortImagesByDate(imageDocs);
  const firstImage = sortedImages.find(
    (image) =>
      typeof image.downloadURL === "string" &&
      image.downloadURL.length > 0,
  );
  const coverImageUrl =
    typeof bentoInfo?.coverImageUrl === "string" && bentoInfo.coverImageUrl.length > 0
      ? bentoInfo.coverImageUrl
      : null;
  const imageCount =
    typeof bentoInfo?.imageCount === "number"
      ? bentoInfo.imageCount
      : sortedImages.length;

  return {
    ...location,
    heroImage:
      coverImageUrl ??
      (typeof firstImage?.downloadURL === "string"
        ? firstImage.downloadURL
        : null),
    photoCount: imageCount,
  };
}

async function fetchBentoInfoByLocationId(
  locationIds: string[],
  profileUid: string | null,
) {
  if (locationIds.length === 0) {
    return {};
  }

  if (profileUid) {
    const entries = await Promise.all(
      locationIds.map(async (locationId) => {
        const snapshot = await getDoc(
          getBentoInfoDoc(profileUid, locationId),
        );
        const data = snapshot.exists() ? snapshot.data() : {};

        return [
          locationId,
          {
            coverImageUrl:
              typeof data?.coverImageUrl === "string" ? data.coverImageUrl : null,
            imageCount:
              typeof data?.imageCount === "number" ? data.imageCount : null,
          },
        ] as const;
      }),
    );

    return Object.fromEntries(entries);
  }

  return {};
}

function getLocationCollection(profileUid: string | null) {
  return profileUid
    ? collection(db, "users", profileUid, "locations")
    : collection(db, "locations");
}

function getLocationImagesCollection(profileUid: string | null, locationId: string) {
  return profileUid
    ? collection(db, "users", profileUid, "locations", locationId, "images")
    : collection(db, "locations", locationId, "images");
}

function getBentoInfoDoc(profileUid: string, locationId: string) {
  return doc(db, "users", profileUid, "locations", locationId, "meta", "bento-info");
}

function toPublicPreviewLocation(docId: string, data: PublicTopImageDoc): BeenToLocationWithImage | null {
  if (typeof data.downloadURL !== "string" || data.downloadURL.length === 0) {
    return null;
  }

  const locationId =
    typeof data.locationId === "string" && data.locationId.length > 0
      ? data.locationId
      : docId;
  const locationSlug =
    typeof data.locationSlug === "string" && data.locationSlug.length > 0
      ? data.locationSlug
      : locationId;
  const photoCount =
    typeof data.photoCount === "number" && Number.isFinite(data.photoCount)
      ? data.photoCount
      : typeof data.imageCount === "number" && Number.isFinite(data.imageCount)
        ? data.imageCount
        : 1;

  return {
    country:
      typeof data.locationCountry === "string" && data.locationCountry.length > 0
        ? data.locationCountry
        : "Global archive",
    heroImage: data.downloadURL,
    id: `${locationId}-${docId}`,
    name:
      typeof data.locationName === "string" && data.locationName.length > 0
        ? data.locationName
        : locationSlug,
    photoCount,
  };
}

export function useBeenToLocations(options: UseBeenToLocationsOptions = {}) {
  const profile = options.profile ?? null;
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [locations, setLocations] = useState<BeenToLocationWithImage[]>([]);
  const cursorIdRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const locationsRef = useRef<BeenToLocationWithImage[]>([]);
  const versionRef = useRef<string | null>(null);
  const isProfileMode = Boolean(profile);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  const persistCache = useCallback(
    (nextLocations: BeenToLocationWithImage[], nextHasMore: boolean, nextCursorId: string | null) => {
      if (isProfileMode) {
        return;
      }

      if (!versionRef.current) {
        return;
      }

      writeLocationsCache({
        cachedAt: Date.now(),
        cursorId: nextCursorId,
        hasMore: nextHasMore,
        locations: nextLocations,
        version: versionRef.current,
      });
    },
    [isProfileMode],
  );

  const fetchPublicPreview = useCallback(async () => {
    if (!profile) {
      return;
    }

    loadingRef.current = true;
    setError(null);
    setInitialLoading(true);

    try {
      const previewQuery = query(
        collection(db, "publicProfiles", profile.username, "topImages"),
        orderBy("rank"),
        limit(PUBLIC_PREVIEW_SIZE),
      );
      const snapshot = await getDocs(previewQuery);
      const previewLocations = snapshot.docs
        .map((snapshotDoc) =>
          toPublicPreviewLocation(
            snapshotDoc.id,
            snapshotDoc.data() as PublicTopImageDoc,
          ),
        )
        .filter((location): location is BeenToLocationWithImage => Boolean(location));

      cursorIdRef.current = null;
      hasMoreRef.current = false;
      locationsRef.current = previewLocations;
      setLocations(previewLocations);
      setHasMore(false);
    } catch (fetchError) {
      console.error("Failed to load public Been-To-Box preview", fetchError);
      setError("This public Been-To-Box preview could not be loaded right now.");
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [profile]);

  const fetchNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) {
      return;
    }

    if (profile && !currentUser) {
      await fetchPublicPreview();
      return;
    }

    loadingRef.current = true;
    setError(null);

    const isInitialPage = cursorIdRef.current === null && locationsRef.current.length === 0;

    if (isInitialPage) {
      setInitialLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const profileUid = profile?.uid ?? null;
      const locationCollection = getLocationCollection(profileUid);
      const locationQuery = cursorIdRef.current
        ? query(
            locationCollection,
            orderBy(documentId()),
            startAfter(cursorIdRef.current),
            limit(PAGE_SIZE),
          )
        : query(
            locationCollection,
            orderBy(documentId()),
            limit(PAGE_SIZE),
          );
      const locationSnapshot = await getDocs(locationQuery);
      const baseLocations = locationSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<BeenToLocation, "id" | "heroImage" | "photoCount">),
      }));
      const bentoInfoByLocationId = await fetchBentoInfoByLocationId(
        baseLocations.map((location) => location.id),
        profileUid,
      );
      const enrichedLocations = await Promise.all(
        baseLocations.map((location) =>
          enrichLocation(
            location,
            bentoInfoByLocationId[location.id],
            profileUid,
          ),
        ),
      );
      const locationsWithImages = enrichedLocations.filter(hasHeroImage);

      const nextCursorId =
        locationSnapshot.docs[locationSnapshot.docs.length - 1]?.id ?? cursorIdRef.current;
      const nextHasMore = locationSnapshot.docs.length === PAGE_SIZE;

      cursorIdRef.current = nextCursorId;
      hasMoreRef.current = nextHasMore;
      setHasMore(nextHasMore);
      setLocations((currentLocations) => {
        const nextLocations = [...currentLocations, ...locationsWithImages];
        locationsRef.current = nextLocations;
        persistCache(nextLocations, nextHasMore, nextCursorId);

        return nextLocations;
      });
    } catch (fetchError) {
      console.error("Failed to load Been-To-Box locations", fetchError);
      setError("Been-To-Box locations could not be loaded right now.");
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [currentUser, fetchPublicPreview, persistCache, profile]);

  useEffect(() => {
    let isMounted = true;

    const hydrateOrFetch = async () => {
      if (profile && !authReady) {
        return;
      }

      try {
        setInitialLoading(true);
        const version = profile ? null : await fetchLocationsVersion();

        if (!isMounted) {
          return;
        }

        if (!profile && version) {
          versionRef.current = version;
          const cache = readLocationsCache(version);

          if (cache) {
            cursorIdRef.current = cache.cursorId;
            hasMoreRef.current = cache.hasMore;
            locationsRef.current = cache.locations;
            setLocations(cache.locations);
            setHasMore(cache.hasMore);
            setInitialLoading(false);
            return;
          }
        }

        cursorIdRef.current = null;
        hasMoreRef.current = true;
        locationsRef.current = [];
        setLocations([]);
        setHasMore(true);
        await fetchNextPage();
      } catch (metadataError) {
        if (isPermissionDeniedError(metadataError)) {
          console.warn(
            "Been-To-Box cache metadata is not readable. Falling back to direct location fetch.",
          );
        } else {
          console.error("Failed to check Been-To-Box cache version", metadataError);
        }

        if (isMounted) {
          await fetchNextPage();
        }
      }
    };

    hydrateOrFetch();

    return () => {
      isMounted = false;
    };
  }, [authReady, currentUser, fetchNextPage, profile]);

  const isAuthenticated = Boolean(currentUser);
  const primaryLocations = useMemo(
    () => locations.slice(0, PAGE_SIZE),
    [locations],
  );
  const archiveLocations = useMemo(
    () => locations.slice(PAGE_SIZE),
    [locations],
  );
  const stats = useMemo(() => buildBeenToStats(locations), [locations]);

  return {
    archiveLocations,
    authReady,
    error,
    hasMore,
    initialLoading,
    isAuthenticated,
    isPublicPreview: Boolean(profile && authReady && !currentUser),
    loadingMore,
    loadMore: fetchNextPage,
    locations,
    primaryLocations,
    profile,
    stats,
  };
}
