'use client';

import { useEffect, useRef } from 'react';

interface AdBannerProps {
  dataAdSlot: string;
  dataAdFormat?: 'auto' | 'fluid' | 'rectangle';
  fullWidthResponsive?: boolean;
  className?: string;
}

export default function AdBanner({ 
  dataAdSlot, 
  dataAdFormat = 'auto', 
  fullWidthResponsive = true,
  className = ""
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    // We use a small delay to ensure the DOM has calculated widths correctly, 
    // especially in flex containers.
    const timer = setTimeout(() => {
      try {
        if (adRef.current && adRef.current.offsetWidth > 0) {
          // @ts-ignore
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      } catch (err) {
        console.error('AdSense error:', err);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [dataAdSlot]); // Re-run if slot changes (e.g. navigation)

  const pubId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;

  if (!pubId || !dataAdSlot) return null;

  return (
    <div className={className}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={pubId}
        data-ad-slot={dataAdSlot}
        data-ad-format={dataAdFormat}
        data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
      />
    </div>
  );
}
