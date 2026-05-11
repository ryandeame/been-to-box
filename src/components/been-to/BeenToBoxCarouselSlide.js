'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';

export default function BeenToBoxCarouselSlide({
  image,
  left,
  isActive,
  isMobile,
  cityName,
  slideIndex,
  onImageMeasured,
  onOpenCoverMenu,
}) {
  const [loaded, setLoaded] = useState(false);
  const longPressTimerRef = useRef(null);
  const imageSrc = image.downloadURL;

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openCoverMenu = (event) => {
    if (!isActive || !onOpenCoverMenu) {
      return;
    }

    const point = 'touches' in event && event.touches[0]
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : { x: event.clientX, y: event.clientY };

    onOpenCoverMenu(image, point);
  };

  const handleClick = (event) => {
    if (isMobile) {
      return;
    }

    openCoverMenu(event);
  };

  const handleTouchStart = (event) => {
    if (!isMobile) {
      return;
    }

    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      openCoverMenu(event);
    }, 520);
  };

  return (
    <div
      className={
        isMobile
          ? 'relative h-full w-full shrink-0 snap-center'
          : 'absolute aspect-[9/16] w-[28vw] max-w-[400px] transition-all duration-300 ease-in-out'
      }
      style={
        isMobile
          ? undefined
          : {
              left: `${left}px`,
              transform: `scale(${isActive ? 1 : 0.75})`,
              zIndex: isActive ? 2 : 1,
            }
      }
    >
      <div
        className={`relative w-full overflow-hidden ${
          isMobile ? 'aspect-[9/16]' : 'h-full rounded-[1.5rem]'
        }`}
      >
        <div className="absolute inset-0 overflow-hidden bg-[#24110c]">
          <div
            className="absolute inset-0 bg-[linear-gradient(135deg,rgba(143,17,16,0.95),rgba(250,204,21,0.34),rgba(20,184,166,0.26),rgba(36,17,12,0.95))]"
            style={{ filter: loaded ? 'blur(0px)' : 'blur(30px)' }}
          />
        </div>

        <Image
          src={imageSrc}
          alt={`${cityName} photo ${slideIndex + 1}`}
          fill
          sizes="(min-width: 1024px) 28vw, 100vw"
          className={`relative h-full w-full object-contain transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          unoptimized={imageSrc?.startsWith('http')}
          onClick={handleClick}
          onLoad={(event) => {
            setLoaded(true);
            onImageMeasured?.(image.id, {
              height: event.currentTarget.naturalHeight,
              width: event.currentTarget.naturalWidth,
            });
          }}
          onTouchCancel={clearLongPressTimer}
          onTouchEnd={clearLongPressTimer}
          onTouchMove={clearLongPressTimer}
          onTouchStart={handleTouchStart}
        />
      </div>
    </div>
  );
}
