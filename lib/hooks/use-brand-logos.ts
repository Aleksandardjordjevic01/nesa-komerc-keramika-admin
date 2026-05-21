'use client';

import { useState, useEffect } from 'react';
import { getBrandLogos, type BrandLogos } from '../api/brand';

const FALLBACK: BrandLogos = { white: null, black: null, color: null };

export function useBrandLogos(): BrandLogos {
  const [logos, setLogos] = useState<BrandLogos>(FALLBACK);

  useEffect(() => {
    getBrandLogos().then(setLogos);
  }, []);

  return logos;
}
