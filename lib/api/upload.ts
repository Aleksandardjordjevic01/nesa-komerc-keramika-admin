const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

async function uploadFile(path: string, file: File, fieldName = 'file'): Promise<string> {
  const token = getToken();
  const formData = new FormData();
  formData.append(fieldName, file);

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = body?.message ?? `HTTP ${res.status}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
  }

  // Backend returns { success: true, data: { url: string } } or { data: string }
  const url = body?.data?.url ?? body?.data ?? body?.url;
  if (!url) throw new Error('Upload nije vratio URL fajla');
  return url as string;
}

export async function uploadCategoryIcon(file: File): Promise<string> {
  return uploadFile('/upload/category-icon', file);
}

export async function uploadCategoryImage(file: File): Promise<string> {
  return uploadFile('/upload/category-image', file);
}

export async function uploadProductImage(file: File): Promise<string> {
  return uploadFile('/upload/product-image', file);
}

export async function uploadVariantIcon(file: File): Promise<string> {
  return uploadFile('/upload/variant-icon', file);
}

export async function uploadBrandLogo(file: File): Promise<string> {
  return uploadFile('/upload/brand-logo', file);
}

export async function deleteUpload(url: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}/upload`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
