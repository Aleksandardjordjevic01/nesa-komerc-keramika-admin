const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface BrandLogos {
  white: string | null;
  black: string | null;
  color: string | null;
}

const FALLBACK: BrandLogos = { white: null, black: null, color: null };

let cache: { data: BrandLogos; expiresAt: number } | null = null;

export async function getBrandLogos(): Promise<BrandLogos> {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  try {
    const res = await fetch(`${API_URL}/brand/logos`);
    if (!res.ok) return FALLBACK;
    const body = await res.json();
    const data: BrandLogos = body?.data ?? body;
    cache = { data, expiresAt: Date.now() + 5 * 60 * 1000 };
    return data;
  } catch {
    return FALLBACK;
  }
}
