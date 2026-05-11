'use client';

import { useCallback, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';

const CACHE_KEY = 'been-to-box:locations-cache:v1';
const COVER_UPDATED_KEY = 'been-to-box:cover-updated';

export function useBeenToCoverPhoto() {
  const { user } = useAuth();
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const updateCoverPhoto = useCallback(async ({ image, locationId }) => {
    if (!locationId || !image?.downloadURL) {
      throw new Error('A location and image are required to update the cover photo.');
    }

    setError(null);
    setSaving(true);

    try {
      if (!user) {
        throw new Error('Sign in before updating cover photos.');
      }

      const locationRef = doc(db, 'users', user.uid, 'locations', locationId);
      const locationSnapshot = await getDoc(locationRef);

      if (!locationSnapshot.exists()) {
        throw new Error('This cover photo can only be updated by the owner.');
      }

      const imageSnapshot = await getDoc(
        doc(db, 'users', user.uid, 'locations', locationId, 'images', image.id),
      );

      if (!imageSnapshot.exists()) {
        throw new Error('Image not found for this location.');
      }

      const locationData = locationSnapshot.data() ?? {};
      const imageData = imageSnapshot.data() ?? {};
      const imageDownloadURL =
        typeof imageData.downloadURL === 'string' && imageData.downloadURL
          ? imageData.downloadURL
          : image.downloadURL;
      const imageStoragePath =
        typeof imageData.storagePath === 'string' && imageData.storagePath
          ? imageData.storagePath
          : image.storagePath ?? '';
      const coverImageWidth = Number(image.width ?? imageData.width ?? imageData.imageWidth ?? 0) || null;
      const coverImageHeight = Number(image.height ?? imageData.height ?? imageData.imageHeight ?? 0) || null;
      const coverImageRatio =
        coverImageWidth && coverImageHeight ? coverImageWidth / coverImageHeight : null;
      const bentoInfoRef = doc(
        db,
        'users',
        user.uid,
        'locations',
        locationId,
        'meta',
        'bento-info',
      );
      const bentoInfoSnapshot = await getDoc(bentoInfoRef);
      const bentoInfo = bentoInfoSnapshot.exists() ? bentoInfoSnapshot.data() : {};
      const imageCount = Number.isFinite(bentoInfo?.imageCount)
        ? Number(bentoInfo.imageCount)
        : null;

      await setDoc(
        bentoInfoRef,
        {
          coverImageHeight,
          coverImageId: image.id,
          coverImagePath: imageStoragePath,
          coverImageRatio,
          coverImageUrl: imageDownloadURL,
          coverImageWidth,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        },
        { merge: true },
      );

      await setDoc(
        doc(db, 'users', user.uid),
        {
          locationsVersion: increment(1),
          updatedAt: serverTimestamp(),
          updatedBy: 'client:useBeenToCoverPhoto',
          updatedByUid: user.uid,
        },
        { merge: true },
      );

      const userSnapshot = await getDoc(doc(db, 'users', user.uid));
      const username = userSnapshot.exists() ? userSnapshot.data()?.username : '';

      if (typeof username === 'string' && username) {
        try {
          const publicTopImageSnapshot = await getDocs(
            query(
              collection(db, 'publicProfiles', username, 'topImages'),
              where('locationId', '==', locationId),
              limit(1),
            ),
          );

          if (!publicTopImageSnapshot.empty) {
            await setDoc(
              publicTopImageSnapshot.docs[0].ref,
              {
                downloadURL: imageDownloadURL,
                height: coverImageHeight,
                imageCount,
                imageId: image.id,
                locationCountry:
                  typeof locationData.country === 'string' ? locationData.country : '',
                locationName:
                  typeof locationData.name === 'string' ? locationData.name : locationId,
                locationSlug:
                  typeof locationData.slug === 'string' ? locationData.slug : locationId,
                ownerUid: user.uid,
                photoCount: imageCount,
                storagePath: imageStoragePath,
                updatedAt: serverTimestamp(),
                width: coverImageWidth,
              },
              { merge: true },
            );
          }
        } catch (publicPreviewError) {
          console.warn('Cover photo saved, but public preview sync failed', publicPreviewError);
        }
      }

      window.localStorage.removeItem(CACHE_KEY);
      window.sessionStorage.removeItem('been-to-box:image-dimensions:v2');
      window.sessionStorage.setItem(COVER_UPDATED_KEY, '1');
    } catch (updateError) {
      setError(updateError);
      throw updateError;
    } finally {
      setSaving(false);
    }
  }, [user]);

  return {
    error,
    saving,
    updateCoverPhoto,
  };
}
