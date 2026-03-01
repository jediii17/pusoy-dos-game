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
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, []);

  const pubId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;

  if (!pubId || !dataAdSlot) return null;

  return (
    <div className={`ad-container ${className}`} style={{ overflow: 'hidden', minHeight: '90px' }}>
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
