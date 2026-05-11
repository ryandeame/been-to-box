'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import BeenToBoxCarouselSlide from '@/components/been-to/BeenToBoxCarouselSlide';
import { useBeenToCoverPhoto } from '@/components/been-to/useBeenToCoverPhoto';

export default function BeenToBoxCarouselOverlay({
  overlayCity,
  currentSlide,
  handleClose,
  onSlideChange,
}) {
  const carouselRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [confirmImage, setConfirmImage] = useState(null);
  const [coverMenu, setCoverMenu] = useState(null);
  const [dimensionsByImageId, setDimensionsByImageId] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const { error, saving, updateCoverPhoto } = useBeenToCoverPhoto();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile || !carouselRef.current || !overlayCity?.images?.length) {
      return;
    }

    window.setTimeout(() => {
      if (carouselRef.current) {
        const slideWidth = carouselRef.current.clientWidth;
        carouselRef.current.scrollLeft = slideWidth * currentSlide;
      }
    }, 0);
  }, [isMobile, overlayCity, currentSlide]);

  const visibleSlides = useMemo(() => {
    if (!overlayCity) {
      return [];
    }

    const { images } = overlayCity;
    if (isMobile) {
      return images.map((image, index) => ({
        image,
        index,
        isActive: index === currentSlide,
      }));
    }

    const viewportWidth =
      typeof window !== 'undefined' ? window.innerWidth : 1440;
    const slideWidth = viewportWidth > 1428 ? 400 : viewportWidth * 0.28;
    const slideMargin = viewportWidth * 0.02;
    const centerLeft = viewportWidth / 2 - slideWidth / 2;

    const slides = [];

    if (currentSlide < images.length) {
      slides.push({
        image: images[currentSlide],
        index: currentSlide,
        isActive: true,
        left: centerLeft,
      });
    }

    if (currentSlide > 0) {
      slides.push({
        image: images[currentSlide - 1],
        index: currentSlide - 1,
        isActive: false,
        left: centerLeft - slideWidth - slideMargin,
      });
    }

    if (currentSlide + 1 < images.length) {
      slides.push({
        image: images[currentSlide + 1],
        index: currentSlide + 1,
        isActive: false,
        left: centerLeft + slideWidth + slideMargin,
      });
    }

    return slides.sort((a, b) => a.index - b.index);
  }, [overlayCity, currentSlide, isMobile]);

  const navigateCarousel = (direction) => {
    if (!overlayCity) return;

    const totalImages = overlayCity.images.length;
    if (direction === 'next') {
      onSlideChange(Math.min(currentSlide + 1, totalImages - 1));
      return;
    }

    onSlideChange(Math.max(currentSlide - 1, 0));
  };

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const nextIndex = Math.round(
      carouselRef.current.scrollLeft / carouselRef.current.clientWidth,
    );
    if (nextIndex !== currentSlide) {
      onSlideChange(nextIndex);
    }
  };

  const handleImageMeasured = (imageId, dimensions) => {
    setDimensionsByImageId((currentDimensions) => ({
      ...currentDimensions,
      [imageId]: dimensions,
    }));
  };

  const handleOpenCoverMenu = (image, point) => {
    setSuccessMessage('');
    setCoverMenu({
      image,
      x: Math.min(Math.max(point.x, 18), window.innerWidth - 220),
      y: Math.min(Math.max(point.y, 18), window.innerHeight - 96),
    });
  };

  const handleConfirmCover = async () => {
    if (!confirmImage || !overlayCity?.id) {
      return;
    }

    const measuredDimensions = dimensionsByImageId[confirmImage.id] ?? {};

    await updateCoverPhoto({
      image: {
        ...confirmImage,
        ...measuredDimensions,
      },
      locationId: overlayCity.id,
    });

    setConfirmImage(null);
    setCoverMenu(null);
    setSuccessMessage('Cover photo updated.');
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#120504]">
      <div
        className={`fixed inset-0 z-[1000] flex flex-col bg-[#120504] text-[#fff4cf] transition-transform duration-500 ease-in-out ${
          overlayCity ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ perspective: '1000px' }}
      >
        <button
          onClick={handleClose}
          className="absolute right-6 top-4 z-[1001] rounded-full border-2 border-[#fff4cf] bg-[#8f1110] px-4 py-2 text-2xl font-black text-[#fff4cf] shadow-[0_7px_0_rgba(0,0,0,0.28)]"
        >
          ×
        </button>

        {overlayCity ? (
          <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.2),transparent_30%),radial-gradient(circle_at_80%_70%,rgba(20,184,166,0.16),transparent_32%)]" />

            {!isMobile && overlayCity.images.length > 1 ? (
              <>
                {currentSlide > 0 ? (
                  <button
                    onClick={() => navigateCarousel('prev')}
                    className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-[#fff4cf] px-5 py-4 text-3xl font-black text-[#24110c] shadow-[0_8px_0_rgba(0,0,0,0.26)]"
                  >
                    &lt;
                  </button>
                ) : null}
                {currentSlide < overlayCity.images.length - 1 ? (
                  <button
                    onClick={() => navigateCarousel('next')}
                    className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-[#fff4cf] px-5 py-4 text-3xl font-black text-[#24110c] shadow-[0_8px_0_rgba(0,0,0,0.26)]"
                  >
                    &gt;
                  </button>
                ) : null}
              </>
            ) : null}

            <div
              ref={carouselRef}
              onScroll={isMobile ? handleScroll : undefined}
              className={`relative z-[1] mx-auto flex h-full w-full items-center ${
                isMobile
                  ? 'snap-x snap-mandatory overflow-x-auto px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                  : 'p-[2vw]'
              }`}
            >
              {overlayCity.images.length > 0 ? (
                visibleSlides.map(({ image, index, left, isActive }) => (
                  <BeenToBoxCarouselSlide
                    key={index}
                    image={image}
                    left={left}
                    isActive={isActive}
                    isMobile={isMobile}
                    slideIndex={index}
                    cityName={overlayCity.name}
                    onImageMeasured={handleImageMeasured}
                    onOpenCoverMenu={handleOpenCoverMenu}
                  />
                ))
              ) : (
                <span className="mx-auto rounded-2xl bg-[#fff4cf] px-5 py-3 text-[#24110c]">
                  No photos.
                </span>
              )}
            </div>

            <div className="absolute bottom-8 left-1/2 z-[1003] flex -translate-x-1/2 flex-col items-center text-[#fff4cf]">
              <h1 className="rounded-2xl border-2 border-[#fff4cf]/25 bg-[#24110c]/70 px-5 py-3 text-center text-xl font-black shadow-[0_8px_0_rgba(0,0,0,0.22)] backdrop-blur">
                {overlayCity.name}
              </h1>
              {isMobile && overlayCity.images.length > 1 ? (
                <div className="mt-3 flex items-center justify-center rounded-full bg-[#24110c]/70 px-4 py-2 text-sm font-black uppercase tracking-[0.12em] backdrop-blur">
                  Swipe
                </div>
              ) : null}
            </div>

            {coverMenu ? (
              <div
                className="fixed z-[1005] w-52 rounded-2xl border-2 border-[#fff4cf]/40 bg-[#24110c] p-2 text-[#fff4cf] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
                style={{ left: coverMenu.x, top: coverMenu.y }}
              >
                <button
                  className="w-full rounded-xl bg-[#fff4cf] px-4 py-3 text-left text-sm font-black uppercase tracking-[0.12em] text-[#24110c] transition-transform hover:-translate-y-0.5"
                  onClick={() => {
                    setConfirmImage(coverMenu.image);
                    setCoverMenu(null);
                  }}
                >
                  Make cover photo.
                </button>
              </div>
            ) : null}

            {confirmImage ? (
              <div className="fixed inset-0 z-[1006] grid place-items-center bg-black/65 px-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-[2rem] border-[6px] border-[#151313] bg-[#fff4cf] p-6 text-center text-[#24110c] shadow-[0_22px_0_rgba(0,0,0,0.25)]">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8f1110]">
                    Cover photo
                  </p>
                  <h2 className="mt-3 text-3xl font-black leading-tight">
                    Make cover photo for {overlayCity.name}?
                  </h2>
                  {error ? (
                    <p className="mt-4 rounded-2xl bg-[#8f1110] px-4 py-3 text-sm font-bold text-[#fff4cf]">
                      {error instanceof Error
                        ? error.message
                        : 'Could not update the cover photo. Check Firebase permissions and try again.'}
                    </p>
                  ) : null}
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      className="rounded-full border-2 border-[#24110c]/20 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#24110c]"
                      disabled={saving}
                      onClick={() => setConfirmImage(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="rounded-full bg-[#8f1110] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#fff4cf] shadow-[0_7px_0_rgba(36,17,12,0.22)] disabled:opacity-60"
                      disabled={saving}
                      onClick={handleConfirmCover}
                    >
                      {saving ? 'Saving...' : 'Yes'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {successMessage ? (
              <div className="fixed bottom-6 right-6 z-[1007] rounded-full bg-[#14b8a6] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#06251f] shadow-[0_8px_0_rgba(0,0,0,0.2)]">
                {successMessage}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
