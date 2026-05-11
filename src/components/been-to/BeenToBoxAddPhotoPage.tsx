"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { ArrowLeft, ChevronDown, ImagePlus, Loader2, MapPin, UploadCloud, X } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { db, storage } from "@/lib/firebase";

const CACHE_KEY = "been-to-box:locations-cache:v1";
const DIMENSION_CACHE_KEY = "been-to-box:image-dimensions:v2";
const MAX_FILES = 5;
const TARGET_BYTES = 950 * 1024;
const MAX_IMAGE_EDGE = 1920;

type ExistingLocation = {
  country: string;
  id: string;
  name: string;
  slug: string;
};

type PreparedPhoto = {
  compressedFile: File;
  previewUrl: string;
};

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not read ${file.name}`));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Could not compress image"));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function compressPhoto(file: File) {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas compression is not available in this browser");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.86;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > TARGET_BYTES && quality > 0.52) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }

  const compressedFile = new File([blob], `${crypto.randomUUID()}.jpg`, {
    type: "image/jpeg",
  });

  return {
    compressedFile,
    previewUrl: URL.createObjectURL(compressedFile),
  } satisfies PreparedPhoto;
}

function isJpegFile(file: File) {
  const fileName = file.name.toLowerCase();

  return file.type === "image/jpeg" || fileName.endsWith(".jpg") || fileName.endsWith(".jpeg");
}

type LocationsPayload = {
  locations: ExistingLocation[];
  ok: boolean;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function loadLocationsFromClient(userId: string) {
  const snapshot = await getDocs(
    query(collection(db, "users", userId, "locations"), orderBy("name")),
  );

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      country: typeof data.country === "string" ? data.country : "",
      id: doc.id,
      name: typeof data.name === "string" ? data.name : doc.id,
      slug: typeof data.slug === "string" ? data.slug : doc.id,
    } satisfies ExistingLocation;
  });
}

export default function BeenToBoxAddPhotoPage() {
  const { loading: authLoading, user } = useAuth();
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [existingLocations, setExistingLocations] = useState<ExistingLocation[]>([]);
  const [locationId, setLocationId] = useState("");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadLocations = async () => {
      if (authLoading) {
        return;
      }

      if (!user) {
        setExistingLocations([]);
        return;
      }

      try {
        const payload: LocationsPayload = {
          locations: await loadLocationsFromClient(user.uid),
          ok: true,
        };

        if (isMounted) {
          setExistingLocations(payload.locations);
        }
      } catch (locationError) {
        console.warn("Could not load Been-To-Box locations", locationError);

        try {
          const fallbackLocations = await loadLocationsFromClient(user.uid);

          if (isMounted) {
            setExistingLocations(fallbackLocations);
          }
        } catch (fallbackError) {
          console.warn("Could not load Been-To-Box locations from client", fallbackError);
          if (isMounted) {
            setMessage("Could not load existing locations. You can still enter a new city and country.");
          }
        }
      }
    };

    loadLocations();

    return () => {
      isMounted = false;
    };
  }, [authLoading, user]);

  useEffect(
    () => () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    },
    [photos],
  );

  const prepareFiles = async (selectedFiles: File[]) => {
    setMessage("");

    if (selectedFiles.length === 0) {
      return;
    }

    const remainingSlots = MAX_FILES - photos.length;

    if (remainingSlots <= 0) {
      setMessage("You can upload up to five photos at a time.");
      return;
    }

    const invalidFiles = selectedFiles.filter((file) => !isJpegFile(file));

    if (invalidFiles.length > 0) {
      setMessage("Only JPG images are supported. Please remove any PNG, HEIC, WEBP, or other file types.");
      return;
    }

    const files = selectedFiles.slice(0, remainingSlots);

    if (selectedFiles.length > remainingSlots) {
      setMessage(`Only ${remainingSlots} more photo${remainingSlots === 1 ? "" : "s"} can be added.`);
    }

    try {
      setPreparing(true);
      const compressedPhotos = await Promise.all(files.map((file) => compressPhoto(file)));

      setPhotos((currentPhotos) => [...currentPhotos, ...compressedPhotos]);
    } catch (compressionError) {
      setMessage(
        compressionError instanceof Error
          ? compressionError.message
          : "Could not prepare those photos.",
      );
    } finally {
      setPreparing(false);
    }
  };

  const handleFilesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await prepareFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    await prepareFiles(Array.from(event.dataTransfer.files));
  };

  const removePhoto = (previewUrl: string) => {
    setPhotos((currentPhotos) => {
      const photoToRemove = currentPhotos.find((photo) => photo.previewUrl === previewUrl);

      if (photoToRemove) {
        URL.revokeObjectURL(photoToRemove.previewUrl);
      }

      return currentPhotos.filter((photo) => photo.previewUrl !== previewUrl);
    });
    setMessage("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (photos.length === 0) {
      setMessage("Choose at least one photo.");
      return;
    }

    if (!user) {
      setMessage("Sign in before adding photos.");
      return;
    }

    if (!locationId && (!city.trim() || !country.trim())) {
      setMessage("Pick a location or enter a city and country.");
      return;
    }

    setSubmitting(true);

    try {
      const existingLocation = existingLocations.find((location) => location.id === locationId);
      const targetSlug = existingLocation?.slug ?? slugify(`${city.trim()}-${country.trim()}`);
      const targetId = existingLocation?.id ?? targetSlug;
      const targetName = existingLocation?.name ?? `${city.trim()}, ${country.trim()}`;
      const targetCountry = existingLocation?.country ?? country.trim();
      const locationRef = doc(db, "users", user.uid, "locations", targetId);

      await setDoc(
        locationRef,
        {
          country: targetCountry,
          createdByUid: user.uid,
          lastContributedAt: serverTimestamp(),
          lastContributedByUid: user.uid,
          name: targetName,
          ownerUid: user.uid,
          slug: targetSlug,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        },
        { merge: true },
      );

      for (const photo of photos) {
        const fileName = photo.compressedFile.name;
        const storagePath = `users/${user.uid}/locations/${targetSlug}/${fileName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, photo.compressedFile, {
          cacheControl: "public, max-age=31536000, immutable",
          contentType: "image/jpeg",
        });

        const downloadURL = await getDownloadURL(storageRef);

        await addDoc(collection(locationRef, "images"), {
          contentType: "image/jpeg",
          createdAt: serverTimestamp(),
          downloadURL,
          fileName,
          imageDate: serverTimestamp(),
          originalFileName: fileName,
          ownerUid: user.uid,
          size: photo.compressedFile.size,
          storagePath,
          uploadedByEmail: user.email ?? "",
          uploadedByName: user.displayName ?? "",
          uploadedByUid: user.uid,
        });
      }

      await setDoc(
        doc(db, "users", user.uid, "locations", targetId, "meta", "bento-info"),
        {
          imageCount: increment(photos.length),
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        },
        { merge: true },
      );

      await setDoc(
        doc(db, "users", user.uid),
        {
          locationsVersion: increment(1),
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        },
        { merge: true },
      );

      window.localStorage.removeItem(CACHE_KEY);
      window.sessionStorage.removeItem(DIMENSION_CACHE_KEY);
      setMessage(`Uploaded ${photos.length} photo${photos.length === 1 ? "" : "s"}.`);
      setPhotos((currentPhotos) => {
        currentPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
        return [];
      });
    } catch (uploadError) {
      setMessage(
        uploadError instanceof Error ? uploadError.message : "Photo upload failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8edcf] px-4 py-6 text-[#24110c] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border-2 border-[#24110c]/15 bg-white/60 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] shadow-[0_8px_0_rgba(36,17,12,0.12)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to box
        </Link>

        <div className="mt-6 rounded-[2.5rem] border-[10px] border-[#151313] bg-[#8f1110] p-4 shadow-[0_34px_80px_rgba(36,17,12,0.28)] sm:p-6">
          <div className="rounded-[1.75rem] bg-[#fff4cf] p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#8f1110]">
                  Been-To-Box
                </p>
                <h1 className="mt-2 text-4xl font-black sm:text-6xl">
                  Add Photos
                </h1>
              </div>
              <div className="grid h-20 w-20 place-items-center rounded-full bg-[#f97316] text-white shadow-[0_9px_0_rgba(36,17,12,0.2)]">
                <ImagePlus className="h-9 w-9" />
              </div>
            </div>

            <form className="mt-8 grid gap-6" onSubmit={handleSubmit}>
              {!authLoading && !user ? (
                <div className="rounded-[2rem] border-4 border-[#24110c] bg-[#facc15] p-5 shadow-[0_10px_0_rgba(36,17,12,0.18)]">
                  <p className="text-xl font-black">
                    Sign in to add photos to Been-To-Box.
                  </p>
                  <p className="mt-2 text-sm font-bold text-[#8f1110]/75">
                    New uploads are saved with your Firebase user ID so the database can track ownership and contributions.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      className="rounded-full bg-[#24110c] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#fff4cf]"
                      href="/sign-in?redirect=/add-photo"
                    >
                      Sign in
                    </Link>
                    <Link
                      className="rounded-full border-2 border-[#24110c]/20 bg-[#f97316] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white"
                      href="/sign-up?redirect=/add-photo"
                    >
                      Create account
                    </Link>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4">
                <div className="grid gap-3 rounded-[2rem] border-2 border-[#24110c]/15 bg-[linear-gradient(135deg,#f97316_0%,#facc15_42%,#14b8a6_100%)] p-1 shadow-[0_12px_0_rgba(36,17,12,0.16)]">
                  <div className="rounded-[1.75rem] bg-[#fff4cf]/95 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#24110c] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#fff4cf]">
                        <MapPin className="h-4 w-4 text-[#facc15]" />
                        {showNewLocation ? "New Location" : "Existing location"}
                      </span>
                      <span className="rounded-full bg-[#8f1110]/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8f1110]">
                        {existingLocations.length} places
                      </span>
                    </div>

                    {!showNewLocation ? (
                      <>
                        <div className="relative">
                        <select
                          className="w-full appearance-none rounded-[1.35rem] border-[3px] border-[#24110c] bg-[#f8edcf] px-5 py-4 pr-14 text-lg font-black text-[#24110c] outline-none shadow-[inset_0_-5px_0_rgba(36,17,12,0.08),0_7px_0_rgba(36,17,12,0.16)] transition-transform focus:-translate-y-0.5 focus:border-[#8f1110]"
                          value={locationId}
                          onChange={(event) => setLocationId(event.target.value)}
                        >
                          <option value="">Choose an existing location.</option>
                          {existingLocations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-5 top-1/2 h-6 w-6 -translate-y-1/2 text-[#8f1110]" />
                      </div>
                      <p className="mt-3 text-sm font-bold text-[#8f1110]/75">
                        Pick a saved place to tuck new photos into that compartment.
                      </p>
                      </>
                    ) : (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="grid gap-2">
                            <span className="text-sm font-black uppercase tracking-[0.16em]">
                              City
                            </span>
                            <input
                              className="rounded-[1.35rem] border-[3px] border-[#24110c] bg-[#f8edcf] px-5 py-4 text-lg font-black text-[#24110c] outline-none shadow-[inset_0_-5px_0_rgba(36,17,12,0.08),0_7px_0_rgba(36,17,12,0.16)] transition-transform focus:-translate-y-0.5 focus:border-[#8f1110]"
                              value={city}
                              onChange={(event) => setCity(event.target.value)}
                              placeholder="Tokyo"
                            />
                          </label>
                          <label className="grid gap-2">
                            <span className="text-sm font-black uppercase tracking-[0.16em]">
                              Country
                            </span>
                            <input
                              className="rounded-[1.35rem] border-[3px] border-[#24110c] bg-[#f8edcf] px-5 py-4 text-lg font-black text-[#24110c] outline-none shadow-[inset_0_-5px_0_rgba(36,17,12,0.08),0_7px_0_rgba(36,17,12,0.16)] transition-transform focus:-translate-y-0.5 focus:border-[#8f1110]"
                              value={country}
                              onChange={(event) => setCountry(event.target.value)}
                              placeholder="Japan"
                            />
                          </label>
                        </div>
                        <p className="mt-3 text-sm font-bold text-[#8f1110]/75">
                          Add a fresh compartment for a place that is not in the box yet.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <button
                  className="justify-self-start rounded-full border-2 border-[#24110c]/15 bg-[#14b8a6] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#06251f] shadow-[0_7px_0_rgba(36,17,12,0.14)]"
                  onClick={() => {
                    if (showNewLocation) {
                      setCity("");
                      setCountry("");
                      setShowNewLocation(false);
                      return;
                    }

                    setLocationId("");
                    setShowNewLocation(true);
                  }}
                  type="button"
                >
                  {showNewLocation ? "Choose existing location." : "Create a new location"}
                </button>
              </div>

              <label
                className={`grid cursor-pointer place-items-center rounded-[2rem] border-4 border-dashed px-6 py-10 text-center transition-transform ${
                  dragActive
                    ? "scale-[1.01] border-[#14b8a6] bg-[#14b8a6]/15"
                    : "border-[#8f1110]/35 bg-white/70"
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                <UploadCloud className="mb-3 h-10 w-10 text-[#8f1110]" />
                <span className="text-xl font-black">
                  Drop up to five JPG photos
                </span>
                <span className="mt-2 text-sm font-bold text-[#8f1110]/70">
                  Or click to choose them. Images are compressed in the browser before upload.
                </span>
                <input
                  accept="image/*"
                  className="sr-only"
                  multiple
                  onChange={handleFilesChange}
                  type="file"
                />
              </label>

              {preparing ? (
                <div className="flex items-center gap-3 rounded-2xl bg-[#24110c] px-4 py-3 font-black text-[#fff4cf]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Compressing photos...
                </div>
              ) : null}

              {photos.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {photos.map((photo) => (
                    <div
                      key={photo.previewUrl}
                      className="relative overflow-hidden rounded-2xl border-2 border-[#24110c]/15 bg-white shadow-[0_8px_0_rgba(36,17,12,0.08)]"
                    >
                      <button
                        aria-label="Remove photo"
                        className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#8f1110] text-white shadow-[0_4px_0_rgba(36,17,12,0.22)] transition-transform hover:-translate-y-0.5"
                        onClick={() => removePhoto(photo.previewUrl)}
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt=""
                        className="h-auto w-full"
                        src={photo.previewUrl}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {message ? (
                <p className="rounded-2xl bg-[#24110c] px-4 py-3 font-bold text-[#fff4cf]">
                  {message}
                </p>
              ) : null}

              <button
                className="rounded-full bg-[#8f1110] px-7 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#fff4cf] shadow-[0_9px_0_rgba(36,17,12,0.22)] disabled:opacity-60"
                disabled={authLoading || !user || preparing || submitting}
                type="submit"
              >
                {submitting ? "Uploading..." : "Add photos"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
