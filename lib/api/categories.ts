const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface AdminCategoryNode {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  imageUrl: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  directListingsCount: number;
  totalListingsCount: number;
  children: AdminCategoryNode[];
}

export interface AdminFlatCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  imageUrl: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  directListingsCount: number;
  totalListingsCount: number;
}

export interface AdminCreateCategoryPayload {
  name: string;
  icon?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface AdminUpdateCategoryPayload {
  name?: string;
  icon?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface AdminCategoriesQuery {
  search?: string;
  status?: 'active' | 'inactive';
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

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

  return (body?.data !== undefined ? body.data : body) as T;
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getAdminCategoryTree(query?: AdminCategoriesQuery): Promise<AdminCategoryNode[]> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.status) params.set('status', query.status);
  const qs = params.toString();
  return request<AdminCategoryNode[]>(`/categories/admin/tree${qs ? `?${qs}` : ''}`);
}

export async function getAdminCategoryFlat(query?: AdminCategoriesQuery): Promise<AdminFlatCategory[]> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.status) params.set('status', query.status);
  const qs = params.toString();
  return request<AdminFlatCategory[]>(`/categories${qs ? `?${qs}` : ''}`);
}

export async function getAdminCategory(id: string): Promise<AdminCategoryNode> {
  return request<AdminCategoryNode>(`/categories/${id}`);
}

export async function createAdminCategory(payload: AdminCreateCategoryPayload): Promise<AdminCategoryNode> {
  return request<AdminCategoryNode>('/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminCategory(id: string, payload: AdminUpdateCategoryPayload): Promise<AdminCategoryNode> {
  return request<AdminCategoryNode>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminCategoryStatus(id: string, isActive: boolean): Promise<AdminCategoryNode> {
  return request<AdminCategoryNode>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ isActive }),
  });
}

export async function deleteAdminCategory(id: string): Promise<void> {
  return request<void>(`/categories/${id}`, { method: 'DELETE' });
}

export async function reorderAdminCategories(
  items: Array<{ id: string; parentId?: string | null; sortOrder: number }>,
): Promise<void> {
  return request<void>('/categories/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ items }),
  });
}
