"use client";

import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

const PUBLIC_PREVIEW_SIZE = 10;

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : "";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getTimestampSeconds(value: unknown) {
  if (typeof value === "object" && value && "seconds" in value) {
    return Number((value as { seconds?: number }).seconds ?? 0);
  }

  return 0;
}

function sortImageDocs(
  images: Array<QueryDocumentSnapshot<DocumentData>>,
) {
  return [...images].sort((a, b) => {
    const aData = a.data();
    const bData = b.data();

    return getTimestampSeconds(aData.imageDate) - getTimestampSeconds(bData.imageDate);
  });
}

async function getCoverImage(userId: string, locationId: string) {
  const bentoInfoSnapshot = await getDoc(
    doc(db, "users", userId, "locations", locationId, "meta", "bento-info"),
  );
  const bentoInfo = bentoInfoSnapshot.exists() ? bentoInfoSnapshot.data() : {};

  if (getString(bentoInfo.coverImageUrl)) {
    return {
      downloadURL: getString(bentoInfo.coverImageUrl),
      height: getNumber(bentoInfo.coverImageHeight),
      id: getString(bentoInfo.coverImageId),
      imageCount: getNumber(bentoInfo.imageCount),
      storagePath: getString(bentoInfo.coverImagePath),
      width: getNumber(bentoInfo.coverImageWidth),
    };
  }

  const imageSnapshot = await getDocs(
    collection(db, "users", userId, "locations", locationId, "images"),
  );
  const imageDocs = sortImageDocs(imageSnapshot.docs);
  const firstImageDoc = imageDocs.find((imageDoc) => {
    const data = imageDoc.data();

    return getString(data.downloadURL);
  });

  if (!firstImageDoc) {
    return null;
  }

  const imageData = firstImageDoc.data();
  const imageCount = getNumber(bentoInfo.imageCount) ?? imageDocs.length;

  return {
    downloadURL: getString(imageData.downloadURL),
    height: getNumber(imageData.height) ?? getNumber(imageData.imageHeight),
    id: firstImageDoc.id,
    imageCount,
    storagePath: getString(imageData.storagePath),
    width: getNumber(imageData.width) ?? getNumber(imageData.imageWidth),
  };
}

async function buildPreviewEntry(
  userId: string,
  locationDoc: QueryDocumentSnapshot<DocumentData>,
  rank: number,
) {
  const locationData = locationDoc.data();
  const coverImage = await getCoverImage(userId, locationDoc.id);

  if (!coverImage?.downloadURL) {
    return null;
  }

  return {
    docId: locationDoc.id,
    data: {
      downloadURL: coverImage.downloadURL,
      height: coverImage.height,
      imageCount: coverImage.imageCount,
      imageId: coverImage.id,
      locationCountry: getString(locationData.country),
      locationId: locationDoc.id,
      locationName: getString(locationData.name) || locationDoc.id,
      locationSlug: getString(locationData.slug) || locationDoc.id,
      ownerUid: userId,
      photoCount: coverImage.imageCount,
      rank,
      storagePath: coverImage.storagePath,
      updatedAt: serverTimestamp(),
      width: coverImage.width,
    },
  };
}

export async function syncPublicBeenToBoxPreview(
  user: User,
  options: { username?: string } = {},
) {
  const userSnapshot = await getDoc(doc(db, "users", user.uid));
  const userData = userSnapshot.exists() ? userSnapshot.data() : {};
  const username = options.username || getString(userData.username);

  if (!username) {
    return;
  }

  const locationSnapshot = await getDocs(
    query(
      collection(db, "users", user.uid, "locations"),
      orderBy(documentId()),
      limit(PUBLIC_PREVIEW_SIZE),
    ),
  );
  const previewEntries = (
    await Promise.all(
      locationSnapshot.docs.map((locationDoc, index) =>
        buildPreviewEntry(user.uid, locationDoc, index + 1),
      ),
    )
  ).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const publicProfileRef = doc(db, "publicProfiles", username);

  await setDoc(
    publicProfileRef,
    {
      displayName: user.displayName || getString(userData.displayName) || username,
      photoURL: user.photoURL || getString(userData.photoURL),
      previewImageCount: previewEntries.length,
      uid: user.uid,
      updatedAt: serverTimestamp(),
      username,
    },
    { merge: true },
  );

  const existingPreviewSnapshot = await getDocs(
    collection(db, "publicProfiles", username, "topImages"),
  );
  const nextPreviewIds = new Set(previewEntries.map((entry) => entry.docId));

  await Promise.all([
    ...previewEntries.map((entry) =>
      setDoc(
        doc(db, "publicProfiles", username, "topImages", entry.docId),
        entry.data,
        { merge: true },
      ),
    ),
    ...existingPreviewSnapshot.docs
      .filter((previewDoc) => !nextPreviewIds.has(previewDoc.id))
      .map((previewDoc) => deleteDoc(previewDoc.ref)),
  ]);
}
