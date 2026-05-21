'use client';

import Image from 'next/image';

export type LogoVariant = 'white' | 'black' | 'color';

interface BrandLogoProps {
  variant?: LogoVariant;
  className?: string;
  height?: number;
  width?: number;
}

export function BrandLogo({
  variant = 'color',
  className,
  height = 36,
  width = 140,
}: BrandLogoProps) {
  const filterStyle =
    variant === 'white'
      ? { filter: 'brightness(0) invert(1)' }
      : variant === 'black'
        ? { filter: 'brightness(0)' }
        : undefined;

  return (
    <Image
      src="/images/logo.svg"
      alt="Logo"
      height={height}
      width={width}
      className={className}
      style={filterStyle}
      priority
      unoptimized
    />
  );
}
