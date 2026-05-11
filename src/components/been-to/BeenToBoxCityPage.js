'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';

import { db } from '@/lib/firebase';
import BeenToBoxCarouselOverlay from '@/components/been-to/BeenToBoxCarouselOverlay';

const COVER_UPDATED_KEY = 'been-to-box:cover-updated';

/**
 * @param {{ backHref?: string, locationSlug?: string, profileUid?: string }=} props
 */
export default function BeenToBoxCityPage({
  backHref = '/',
  locationSlug: locationSlugProp,
  profileUid,
} = {}) {
  const params = useParams();
  const router = useRouter();
  const [overlayCity, setOverlayCity] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const citySlug = locationSlugProp ?? params?.locationSlug ?? params?.slug;

    if (typeof citySlug !== 'string' || citySlug.length === 0) {
      return;
    }

    const fetchCityData = async () => {
      try {
        const locationsCol = profileUid
          ? collection(db, 'users', profileUid, 'locations')
          : collection(db, 'locations');
        const cityQuery = query(locationsCol, where('slug', '==', citySlug));
        const querySnapshot = await getDocs(cityQuery);

        if (querySnapshot.empty) {
          router.push(backHref);
          return;
        }

        const cityDoc = querySnapshot.docs[0];
        const cityData = { id: cityDoc.id, ...cityDoc.data() };
        const imagesColRef = profileUid
          ? collection(db, 'users', profileUid, 'locations', cityDoc.id, 'images')
          : collection(db, 'locations', cityDoc.id, 'images');
        const imageSnapshot = await getDocs(imagesColRef);
        const imageData = imageSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        imageData.sort((a, b) => {
          const aHasDate = a.imageDate && a.imageDate.seconds;
          const bHasDate = b.imageDate && b.imageDate.seconds;

          if (aHasDate && bHasDate) return a.imageDate.seconds - b.imageDate.seconds;
          if (aHasDate) return -1;
          if (bHasDate) return 1;
          return 0;
        });

        const fetchedImages = imageData
          .filter((data) => typeof data.downloadURL === 'string' && data.downloadURL.length > 0)
          .map((data) => ({
            downloadURL: data.downloadURL,
            height: data.height ?? data.imageHeight ?? null,
            id: data.id,
            storagePath: data.storagePath ?? '',
            width: data.width ?? data.imageWidth ?? null,
          }));

        setOverlayCity({
          ...cityData,
          images: fetchedImages,
        });
        setCurrentSlide(0);
      } catch (error) {
        console.error('Failed to load Been-To-Box city', error);
        router.push(backHref);
      }
    };

    fetchCityData();
  }, [backHref, locationSlugProp, params, profileUid, router]);

  return (
    <BeenToBoxCarouselOverlay
      overlayCity={overlayCity}
      currentSlide={currentSlide}
      handleClose={() => {
        const shouldRefreshBackPage =
          window.sessionStorage.getItem(COVER_UPDATED_KEY) === '1';

        if (shouldRefreshBackPage) {
          window.sessionStorage.removeItem(COVER_UPDATED_KEY);
          window.location.assign(backHref);
          return;
        }

        if (window.history.length > 1) {
          router.back();
          return;
        }

        router.push(backHref);
      }}
      onSlideChange={setCurrentSlide}
    />
  );
}
