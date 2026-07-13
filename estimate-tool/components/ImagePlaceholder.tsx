'use client';

import { useState } from 'react';

interface ImagePlaceholderProps {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
}

export default function ImagePlaceholder({ src, alt, size = 48, className = '' }: ImagePlaceholderProps) {
  const [error, setError] = useState(false);

  const initials = alt
    .split(/[\s-]+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (!src || error) {
    return (
      <div
        className={`flex-shrink-0 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-semibold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.3 }}
      >
        {initials || '?'}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className={`flex-shrink-0 rounded-lg object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
