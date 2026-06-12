const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/** Encodes non-ASCII chars as \uXXXX so the JSON body is pure ASCII.
 *  This guarantees č,ć,š,đ,ž survive any HTTP transport encoding layer. */
function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value).replace(/[\u0080-\uffff]/g, (c) =>
    `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

// Internal type returned by this backend
interface BackendUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { orders?: number };
}

function mapBackendUser(u: BackendUser): AdminUser {
  return {
    id: u.id,
    email: u.email,
    name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email,
    role: u.role,
  };
}

export type DashboardStats = {
  usersCount: number;
  listingsCount: number;
  activeListingsCount: number;
  parkedListingsCount: number;
  premiumListingsCount: number;
  messagesCount: number;
  reportsCount: number;
};

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

  // Handle wrapper: { success: true, data: ... }
  return (body?.data !== undefined ? body.data : body) as T;
}

// For paginated endpoints that also need the meta object
async function requestPaginated<T>(path: string, init: RequestInit = {}): Promise<{ data: T[]; meta: { total: number; page: number; limit: number; totalPages?: number } }> {
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
  return { data: body.data ?? [], meta: body.meta ?? { total: 0, page: 1, limit: 20 } };
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function adminLogin(email: string, password: string): Promise<{ accessToken: string; admin: AdminUser }> {
  const res = await request<{ user: BackendUser; token: string }>('/auth/login', {
    method: 'POST',
    body: safeJsonStringify({ email, password }),
  });
  return { accessToken: res.token, admin: mapBackendUser(res.user) };
}

export async function adminMe(): Promise<AdminUser> {
  const user = await request<BackendUser>('/auth/me');
  return mapBackendUser(user);
}

export async function adminLogout(): Promise<void> {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const [users, products, orders] = await Promise.all([
    requestPaginated<BackendUser>('/users?limit=1').catch(() => ({ data: [], meta: { total: 0, page: 1, limit: 1 } })),
    requestPaginated<unknown>('/products?limit=1').catch(() => ({ data: [], meta: { total: 0, page: 1, limit: 1 } })),
    requestPaginated<unknown>('/orders?limit=1').catch(() => ({ data: [], meta: { total: 0, page: 1, limit: 1 } })),
  ]);
  return {
    usersCount: users.meta.total,
    listingsCount: products.meta.total,
    activeListingsCount: products.meta.total,
    parkedListingsCount: 0,
    premiumListingsCount: 0,
    messagesCount: orders.meta.total,
    reportsCount: 0,
  };
}

// ── Users ─────────────────────────────────────────────────────────────────────

export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface AdminUserListItem {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  phone: string | null;
  city: string | null;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  ordersCount: number;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface AdminUserRecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  itemsCount: number;
}

export interface AdminUserDetail extends AdminUserListItem {
  slug: string;
  firstName: string | null;
  lastName: string | null;
  updatedAt: string;
  stats: {
    ordersCount: number;
    reklamacijeCount: number;
  };
  recentOrders: AdminUserRecentOrder[];
}

export interface AdminUsersMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUsersResponse {
  data: AdminUserListItem[];
  meta: AdminUsersMeta;
}

export interface AdminUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

function mapBackendUserToListItem(u: BackendUser): AdminUserListItem {
  return {
    id: u.id,
    email: u.email,
    username: null,
    displayName: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email,
    phone: u.phone ?? null,
    city: null,
    role: (u.role === 'admin' ? 'ADMIN' : 'USER') as UserRole,
    status: (u.isActive ? 'ACTIVE' : 'INACTIVE') as UserStatus,
    avatarUrl: null,
    ordersCount: u._count?.orders ?? 0,
    createdAt: u.createdAt,
    lastActiveAt: null,
  };
}

export async function getAdminUsers(params: AdminUsersParams = {}): Promise<AdminUsersResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.search) qs.set('search', params.search);
  if (params.role) qs.set('role', params.role === 'ADMIN' ? 'admin' : 'customer');
  if (params.status) qs.set('isActive', params.status === 'ACTIVE' ? 'true' : 'false');
  const result = await requestPaginated<BackendUser>(`/users?${qs.toString()}`);
  return {
    data: result.data.map(mapBackendUserToListItem),
    meta: {
      page: result.meta.page,
      limit: result.meta.limit,
      total: result.meta.total,
      totalPages: result.meta.totalPages ?? Math.ceil(result.meta.total / result.meta.limit),
    },
  };
}

export async function getAdminUser(id: string): Promise<AdminUserDetail> {
  const u = await request<BackendUser>(`/users/${id}`);
  return {
    ...mapBackendUserToListItem(u),
    slug: u.id,
    firstName: u.firstName ?? null,
    lastName: u.lastName ?? null,
    updatedAt: u.updatedAt,
    stats: { ordersCount: u._count?.orders ?? 0, reklamacijeCount: 0 },
    recentOrders: [],
  };
}

export async function updateAdminUser(
  id: string,
  payload: { firstName?: string; lastName?: string; username?: string; phone?: string; city?: string },
): Promise<AdminUserListItem> {
  const u = await request<BackendUser>(`/users/${id}`, { method: 'PUT', body: safeJsonStringify(payload) });
  return mapBackendUserToListItem(u);
}

export interface CreateAdminUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
}

export async function createAdminUser(payload: CreateAdminUserPayload): Promise<AdminUserListItem> {
  const u = await request<BackendUser>('/users', { method: 'POST', body: safeJsonStringify(payload) });
  return mapBackendUserToListItem(u);
}

export async function updateAdminUserStatus(id: string, _status: UserStatus): Promise<AdminUserListItem> {
  const u = await request<BackendUser>(`/users/${id}/toggle-active`, { method: 'PATCH' });
  return mapBackendUserToListItem(u);
}

export async function updateAdminUserRole(id: string, role: UserRole): Promise<AdminUserListItem> {
  const u = await request<BackendUser>(`/users/${id}`, {
    method: 'PUT',
    body: safeJsonStringify({ role: role === 'ADMIN' ? 'admin' : 'customer' }),
  });
  return mapBackendUserToListItem(u);
}

export async function deleteAdminUser(id: string): Promise<AdminUserListItem> {
  return request(`/users/${id}`, { method: 'DELETE' });
}

export interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

export async function searchUsers(q: string, limit = 10): Promise<UserSearchResult[]> {
  return request<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(q)}&limit=${limit}`);
}

interface BackendOrder {
  id: string;
  orderNumber?: string;
  status: string;
  total?: number;
  totalAmount?: number;
  createdAt: string;
  items?: unknown[];
  _count?: { items?: number };
}

export async function getAdminUserOrders(userId: string, limit = 5): Promise<AdminUserRecentOrder[]> {
  try {
    const result = await requestPaginated<BackendOrder>(`/orders?userId=${userId}&limit=${limit}`);
    return result.data.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber ?? `#${o.id.slice(0, 8).toUpperCase()}`,
      status: o.status,
      total: o.total ?? o.totalAmount ?? 0,
      createdAt: o.createdAt,
      itemsCount: o._count?.items ?? (Array.isArray(o.items) ? o.items.length : 0),
    }));
  } catch {
    return [];
  }
}

export async function resetAdminUserPassword(id: string, password: string): Promise<{ message: string }> {
  return request(`/users/${id}`, { method: 'PUT', body: safeJsonStringify({ password }) });
}

export async function sendAdminUserResetEmail(_id: string): Promise<{ message: string; resetLink?: string }> {
  return { message: 'Nije podržano od strane ovog backenda.' };
}

// ── Proizvodi ─────────────────────────────────────────────────────────────────

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  isActive: boolean;
  priceAdjustmentPercent: number | null;
  previousPriceAdjustmentPercent: number | null;
  createdAt: string;
  updatedAt: string;
}

export async function getBrands(): Promise<Brand[]> {
  const res = await request<Brand[] | { data: Brand[] }>('/brands');
  return Array.isArray(res) ? res : (res as { data: Brand[] }).data ?? [];
}

export async function createBrand(payload: Partial<Brand>): Promise<Brand> {
  return request<Brand>('/brands', { method: 'POST', body: safeJsonStringify(payload) });
}

export async function updateBrand(id: string, payload: Partial<Brand>): Promise<Brand> {
  return request<Brand>(`/brands/${id}`, { method: 'PUT', body: safeJsonStringify(payload) });
}

export async function deleteBrand(id: string): Promise<void> {
  return request(`/brands/${id}`, { method: 'DELETE' });
}

export async function applyBrandPriceAdjustment(
  id: string,
  percent: number,
): Promise<{ updatedCount: number; appliedPercent: number; previousPercent: number | null }> {
  return request(`/brands/${id}/price-adjustment`, {
    method: 'PATCH',
    body: safeJsonStringify({ percent }),
  });
}

export async function undoBrandPriceAdjustment(
  id: string,
): Promise<{ updatedCount: number; restoredPercent: number | null }> {
  return request(`/brands/${id}/price-adjustment/undo`, { method: 'POST' });
}

export type VariantItem = {
  name: string;
  type?: 'color' | 'icon' | 'image';
  colorHex?: string;
  iconUrl?: string;
  imageUrl?: string;
};

export interface Product {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  salePrice: number | null;
  discountPercent: number | null;
  saleEndsAt: string | null;
  sku: string | null;
  stock: number;
  variants: VariantItem[] | null;
  specifications: { key: string; value: string }[] | null;
  brandId: string | null;
  brand: Brand | null;
  width: number | null;
  height: number | null;
  thickness: number | null;
  material: string | null;
  finish: string | null;
  usage: string | null;
  images: string[] | null;
  inStock: boolean;
  isActive: boolean;
  isFeatured: boolean;
  categoryId: string;
  category: { id: string; name: string; slug: string };
  createdAt: string;
  updatedAt: string;
}

export interface ProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  isFeatured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  material?: string;
  finish?: string;
  usage?: string;
}

export interface ProductsMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductsResponse {
  data: Product[];
  meta: ProductsMeta;
}

export async function getProducts(params: ProductsParams = {}): Promise<ProductsResponse> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  const res = await requestPaginated<Product>(`/products?${qs.toString()}`);
  return {
    data: res.data,
    meta: { ...res.meta, totalPages: res.meta.totalPages ?? Math.ceil(res.meta.total / res.meta.limit) },
  };
}

export async function getProduct(id: string): Promise<Product> {
  return request<Product>(`/products/${id}`);
}

export async function createProduct(payload: Partial<Product>): Promise<Product> {
  return request<Product>('/products', { method: 'POST', body: safeJsonStringify(payload) });
}

export async function updateProduct(id: string, payload: Partial<Product>): Promise<Product> {
  return request<Product>(`/products/${id}`, { method: 'PUT', body: safeJsonStringify(payload) });
}

export async function deleteProduct(id: string): Promise<void> {
  return request(`/products/${id}`, { method: 'DELETE' });
}

export async function patchProductInStock(id: string, inStock: boolean): Promise<void> {
  return request(`/products/${id}/in-stock`, { method: 'PATCH', body: safeJsonStringify({ inStock }) });
}

// ── Narudžbine ─────────────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type PaymentMethod = 'card' | 'invoice' | 'cash_on_delivery';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: { id: string; name: string; sku: string | null; images: string[] };
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotalAmount: number;
  discountAmount: number;
  couponCode: string | null;
  totalAmount: number;
  shippingCost: number;
  shippingAddress: string;
  shippingCity: string;
  shippingZipCode: string;
  shippingCountry: string;
  companyName: string | null;
  pib: string | null;
  mb: string | null;
  notes: string | null;
  userId: string;
  user: { id: string; firstName: string; lastName: string; email: string; phone: string | null };
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrdersParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
}

export interface OrdersResponse {
  data: Order[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function getOrders(params: OrdersParams = {}): Promise<OrdersResponse> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  const res = await requestPaginated<Order>(`/orders?${qs.toString()}`);
  return {
    data: res.data,
    meta: { ...res.meta, totalPages: res.meta.totalPages ?? Math.ceil(res.meta.total / res.meta.limit) },
  };
}

export async function getOrder(id: string): Promise<Order> {
  return request<Order>(`/orders/${id}`);
}

export interface OrderStatusEmailResult {
  data: Order;
  email?: { sent: boolean; message?: string };
}

async function patchOrderStatusWithEmail(
  path: string,
  body: Record<string, string>,
): Promise<OrderStatusEmailResult> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: safeJsonStringify(body),
  });

  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = responseBody?.message ?? `HTTP ${res.status}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
  }

  return {
    data: (responseBody?.data ?? responseBody) as Order,
    email: responseBody?.email,
  };
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<OrderStatusEmailResult> {
  return patchOrderStatusWithEmail(`/orders/${id}/status`, { status });
}

export async function updateOrderPaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<OrderStatusEmailResult> {
  return patchOrderStatusWithEmail(`/orders/${id}/payment-status`, { paymentStatus });
}

export interface UpdateOrderItemPayload {
  productId: string;
  quantity: number;
  unitPrice?: number;
}

export interface UpdateOrderPayload {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingZipCode?: string;
  shippingCountry?: string;
  shippingCost?: number;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  companyName?: string;
  pib?: string;
  mb?: string;
  notes?: string;
  couponCode?: string;
  discountAmount?: number;
  items?: UpdateOrderItemPayload[];
}

export async function updateOrder(id: string, payload: UpdateOrderPayload): Promise<Order> {
  return request<Order>(`/orders/${id}`, { method: 'PUT', body: safeJsonStringify(payload) });
}

export async function deleteOrder(id: string): Promise<void> {
  await request<void>(`/orders/${id}`, { method: 'DELETE' });
}

export async function downloadOrderPdf(id: string, orderNumber: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}/orders/${id}/pdf`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `narudzbina-${orderNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Geo autocomplete ─────────────────────────────────────────────────────────

export interface GeoCity {
  name: string;
  postcode: string;
}

export interface GeoAddress {
  address: string;
  postcode: string;
}

type GeoApiBody = unknown[] | { success?: boolean; data?: unknown; message?: unknown };

const SERBIAN_CITY_POSTCODES: Record<string, string> = {
  Beograd: '11000',
  'Novi Sad': '21000',
  Nis: '18000',
  Kragujevac: '34000',
  Subotica: '24000',
  Leskovac: '16000',
  Pancevo: '26000',
  Krusevac: '37000',
  Kraljevo: '36000',
  'Novi Pazar': '36300',
  Zrenjanin: '23000',
  Cacak: '32000',
  Sabac: '15000',
  Smederevo: '11300',
  Valjevo: '14000',
  Vranje: '17500',
  'Sremska Mitrovica': '22000',
  Loznica: '15300',
  Sombor: '25000',
  Uzice: '31000',
  Pozarevac: '12000',
  Jagodina: '35000',
  Pirot: '18300',
  Kikinda: '23300',
  Ruma: '22400',
  'Backa Palanka': '21400',
  Zajecar: '19000',
  Paracin: '35250',
  Vrsac: '26300',
  Indjija: '22320',
  Aleksinac: '18220',
  'Smederevska Palanka': '11420',
  Arandjelovac: '34300',
  Bor: '19210',
  Prokuplje: '18400',
  Vrbas: '21460',
  Trstenik: '37240',
  Kula: '25230',
  'Velika Plana': '11320',
  Presevo: '17523',
  Prijepolje: '31300',
  Becej: '21220',
  Negotin: '19300',
  Kovin: '26220',
  Sid: '22240',
  Ivanjica: '32250',
  'Backa Topola': '24300',
  Pozega: '31210',
  Temerin: '21235',
  Cuprija: '35230',
  Apatin: '25260',
  Raska: '36350',
  Svilajnac: '35210',
  Zemun: '11080',
  Lazarevac: '11550',
  Obrenovac: '11500',
  Mladenovac: '11400',
};

const SERBIAN_CITY_NAMES = [
  'Beograd', 'Novi Sad', 'Nis', 'Kragujevac', 'Subotica', 'Leskovac', 'Pancevo',
  'Krusevac', 'Kraljevo', 'Novi Pazar', 'Zrenjanin', 'Cacak', 'Sabac',
  'Smederevo', 'Valjevo', 'Vranje', 'Sremska Mitrovica', 'Loznica', 'Sombor',
  'Uzice', 'Pozarevac', 'Jagodina', 'Stara Pazova', 'Pirot', 'Kikinda', 'Ruma',
  'Backa Palanka', 'Zajecar', 'Paracin', 'Vrsac', 'Indjija', 'Aleksinac',
  'Smederevska Palanka', 'Arandjelovac', 'Bujanovac', 'Bor', 'Gornji Milanovac',
  'Prokuplje', 'Vrbas', 'Trstenik', 'Kula', 'Velika Plana', 'Presevo', 'Tutin',
  'Prijepolje', 'Becej', 'Negotin', 'Kovin', 'Sid', 'Ivanjica', 'Backa Topola',
  'Pozega', 'Petrovac na Mlavi', 'Temerin', 'Ub', 'Vlasotince', 'Knjazevac',
  'Cuprija', 'Vrnjacka Banja', 'Odzaci', 'Bogatic', 'Sjenica', 'Zabalj',
  'Bajina Basta', 'Priboj', 'Apatin', 'Aleksandrovac', 'Raska', 'Kovacica',
  'Kanjiza', 'Svilajnac', 'Novi Becej', 'Topola', 'Pecinci', 'Despotovac',
  'Lebane', 'Senta', 'Vladicin Han', 'Kladovo', 'Alibunar', 'Arilje',
  'Surdulica', 'Lucani', 'Doljevac', 'Kursumlija', 'Veliko Gradiste',
  'Cajetina', 'Majdanpek', 'Bela Crkva', 'Vladimirci', 'Krupanj', 'Srbobran',
  'Varvarin', 'Titel', 'Beocin', 'Lajkovac', 'Zitoradja', 'Brus', 'Nova Varos',
  'Zitiste', 'Ada', 'Sokobanja', 'Ljubovija', 'Mionica', 'Merosina', 'Kucevo',
  'Knic', 'Backi Petrovac', 'Bac', 'Mali Zvornik', 'Koceljeva', 'Svrljig',
  'Ljig', 'Secanj', 'Boljevac', 'Kosjeric', 'Batocina', 'Mali Idjos',
  'Osecina', 'Bela Palanka', 'Zagubica', 'Blace', 'Raca', 'Opovo', 'Bojnik',
  'Irig', 'Zabari', 'Babusnica', 'Malo Crnice', 'Plandiste', 'Novi Knezevac',
  'Coka', 'Nova Crnja', 'Rekovac', 'Dimitrovgrad', 'Sremski Karlovci',
  'Cicevac', 'Razanj', 'Golubac', 'Lapovo', 'Medvedja', 'Bosilegrad',
  'Gadzin Han', 'Trgoviste', 'Crna Trava',
  'Zemun', 'Novi Beograd', 'Surcin', 'Palilula', 'Vozdovac', 'Zvezdara',
  'Vracar', 'Stari Grad', 'Savski Venac', 'Cukarica', 'Rakovica', 'Grocka',
  'Barajevo', 'Sopot', 'Lazarevac', 'Obrenovac', 'Mladenovac',
  'Petrovaradin', 'Sremska Kamenica', 'Veternik', 'Futog',
];

const SERBIAN_CITY_FALLBACK: GeoCity[] = Array.from(new Set(SERBIAN_CITY_NAMES)).map((name) => ({
  name,
  postcode: SERBIAN_CITY_POSTCODES[name] ?? '',
}));

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function geoDataArray(body: GeoApiBody): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: unknown[] }).data;
  }
  return [];
}

function geoErrorMessage(body: GeoApiBody): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : null;
}

function fallbackCities(q: string): GeoCity[] {
  const normalized = normalizeSearchText(q.trim());
  const matches = normalized
    ? SERBIAN_CITY_FALLBACK.filter((city) => normalizeSearchText(city.name).includes(normalized))
    : SERBIAN_CITY_FALLBACK;

  return matches.sort((a, b) => {
    const aName = normalizeSearchText(a.name);
    const bName = normalizeSearchText(b.name);
    const aStarts = normalized && aName.startsWith(normalized) ? 0 : 1;
    const bStarts = normalized && bName.startsWith(normalized) ? 0 : 1;
    return aStarts - bStarts || a.name.localeCompare(b.name, 'sr-Latn-RS');
  });
}

function normalizeGeoCity(item: unknown): GeoCity | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const name = record.name ?? record.city ?? record.displayName;
  const postcode = record.postcode ?? record.postalCode ?? record.zipCode ?? '';
  if (typeof name !== 'string' || !name.trim()) return null;
  return {
    name: name.trim(),
    postcode: typeof postcode === 'string' || typeof postcode === 'number' ? String(postcode) : '',
  };
}

function mergeCities(primary: GeoCity[], fallback: GeoCity[]): GeoCity[] {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((city) => {
    const key = normalizeSearchText(city.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeGeoAddress(item: unknown): GeoAddress | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const roadAddress = [record.road, record.houseNumber].filter(Boolean).join(' ');
  const address = record.address || roadAddress || record.displayName;
  const postcode = record.postcode ?? record.postalCode ?? record.zipCode ?? '';
  if (typeof address !== 'string' || !address.trim()) return null;
  return {
    address: address.trim(),
    postcode: typeof postcode === 'string' || typeof postcode === 'number' ? String(postcode) : '',
  };
}

export async function searchCities(q: string): Promise<GeoCity[]> {
  try {
    const res = await fetch(`${API_URL}/geo/cities?q=${encodeURIComponent(q)}`);
    const body = await res.json().catch(() => null) as GeoApiBody | null;
    if (!res.ok) throw new Error(body ? geoErrorMessage(body) ?? `HTTP ${res.status}` : `HTTP ${res.status}`);
    const normalized = geoDataArray(body ?? []).map(normalizeGeoCity).filter((city): city is GeoCity => Boolean(city));
    return mergeCities(normalized, fallbackCities(q));
  } catch {
    return fallbackCities(q);
  }
}

export async function searchAddresses(q: string, city: string): Promise<GeoAddress[]> {
  const params = new URLSearchParams({ q, city });
  const res = await fetch(`${API_URL}/geo/addresses?${params}`);
  const body = await res.json().catch(() => null) as GeoApiBody | null;
  if (!res.ok) throw new Error(body ? geoErrorMessage(body) ?? `HTTP ${res.status}` : `HTTP ${res.status}`);
  return geoDataArray(body ?? []).map(normalizeGeoAddress).filter((address): address is GeoAddress => Boolean(address));
}

// ── Reklamacije ───────────────────────────────────────────────────────────────

export type ComplaintStatus = 'pending' | 'accepted' | 'rejected';

export interface Complaint {
  id: string;
  userId: string;
  user: { id: string; firstName: string; lastName: string; email: string };
  orderId: string;
  order: { id: string; orderNumber: string; totalAmount: number };
  subject: string;
  description: string;
  status: ComplaintStatus;
  adminResponse: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintsParams {
  page?: number;
  limit?: number;
  status?: ComplaintStatus;
}

export interface ComplaintsResponse {
  data: Complaint[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function getComplaints(params: ComplaintsParams = {}): Promise<ComplaintsResponse> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  const res = await requestPaginated<Complaint>(`/complaints?${qs.toString()}`);
  return {
    data: res.data,
    meta: { ...res.meta, totalPages: res.meta.totalPages ?? Math.ceil(res.meta.total / res.meta.limit) },
  };
}

export async function updateComplaintStatus(
  id: string,
  status: ComplaintStatus,
  adminResponse?: string,
): Promise<Complaint> {
  return request<Complaint>(`/complaints/${id}/status`, {
    method: 'PATCH',
    body: safeJsonStringify({ status, adminResponse }),
  });
}

export interface CreateAdminComplaintInput {
  userId?: string;
  userEmail?: string;
  userPhone?: string;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  orderId?: string;
  orderNumber?: string;
  subject: string;
  description: string;
  adminNotes?: string;
}

export async function createAdminComplaint(input: CreateAdminComplaintInput): Promise<Complaint> {
  return request<Complaint>('/complaints/admin', {
    method: 'POST',
    body: safeJsonStringify(input),
  });
}

// ── Kuponi ────────────────────────────────────────────────────────────────────

export type DiscountType = 'percentage' | 'fixed';

export interface Coupon {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number | null;
  maxUsage: number | null;
  usageCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CouponPayload {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount?: number | null;
  maxUsage?: number | null;
  isActive?: boolean;
  expiresAt?: string | null;
}

export async function getCoupons(): Promise<Coupon[]> {
  return request<Coupon[]>('/coupons');
}

export async function createCoupon(payload: CouponPayload): Promise<Coupon> {
  return request<Coupon>('/coupons', { method: 'POST', body: safeJsonStringify(payload) });
}

export async function updateCoupon(id: string, payload: Partial<CouponPayload>): Promise<Coupon> {
  return request<Coupon>(`/coupons/${id}`, { method: 'PATCH', body: safeJsonStringify(payload) });
}

export async function deleteCoupon(id: string): Promise<void> {
  return request(`/coupons/${id}`, { method: 'DELETE' });
}

// ── Dostava ───────────────────────────────────────────────────────────────────

export type ShippingType = 'courier' | 'vehicle' | 'pickup';

export interface ShippingMethod {
  id: string;
  type: ShippingType;
  name: string;
  description: string | null;
  price: number;
  freeAbove: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingMethodPayload {
  type: ShippingType;
  name: string;
  description?: string | null;
  price: number;
  freeAbove?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}

export async function getShippingMethods(): Promise<ShippingMethod[]> {
  return request<ShippingMethod[]>('/shipping-methods/all');
}

export async function createShippingMethod(payload: ShippingMethodPayload): Promise<ShippingMethod> {
  const body = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== null && v !== undefined));
  return request<ShippingMethod>('/shipping-methods', { method: 'POST', body: safeJsonStringify(body) });
}

export async function updateShippingMethod(id: string, payload: Partial<ShippingMethodPayload>): Promise<ShippingMethod> {
  const body = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== null && v !== undefined));
  return request<ShippingMethod>(`/shipping-methods/${id}`, { method: 'PATCH', body: safeJsonStringify(body) });
}

export async function deleteShippingMethod(id: string): Promise<void> {
  return request(`/shipping-methods/${id}`, { method: 'DELETE' });
}

// ── (Legacy — zadržano za kompatibilnost) ──────────────────────────────────────

export type ListingStatus = 'active' | 'expired' | 'removed' | 'parked' | 'suspended' | 'draft';

export interface AdminListingSeller {
  id: string;
  displayName: string;
  email: string;
}

export interface AdminListingItem {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  seller: AdminListingSeller;
  categoryName: string;
  priceAmount: number;
  priceCurrency: string;
  status: string;
  isPremium: boolean;
  isHidden: boolean;
  viewsCount: number;
  savedCount: number;
  publishedAt: string | null;
  expiresAt: string | null;
}

export interface AdminListingsMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminListingsResponse {
  data: AdminListingItem[];
  meta: AdminListingsMeta;
}

export interface AdminListingsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  categoryId?: string;
  sellerId?: string;
  isPremium?: boolean;
  isHidden?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AdminListingImage {
  id: string;
  fileKey: string;
  sortOrder: number;
}

export interface AdminListingDetail {
  id: string;
  numericId: number;
  slug: string;
  title: string;
  description: string;
  priceAmount: number;
  priceCurrency: string;
  priceType: string;
  isPriceFixed: boolean;
  acceptsExchange: boolean;
  condition: string | null;
  listingType: string;
  isAvailableNow: boolean;
  allowsDelivery: boolean;
  allowsPickup: boolean;
  contactCityOverride: string | null;
  showPhoneInListing: boolean;
  location: string | null;
  sellerType: string;
  businessPib: string | null;
  businessName: string | null;
  businessAddress: string | null;
  status: string;
  isPremium: boolean;
  premiumExpiresAt: string | null;
  isHidden: boolean;
  hiddenReason: string | null;
  suspendedReason: string | null;
  viewsCount: number;
  savedCount: number;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  category: { id: string; name: string; slug: string; parentId: string | null };
  seller: {
    id: string;
    email: string;
    slug: string | null;
    username: string | null;
    displayName: string;
    avatarUrl: string | null;
    role: string;
    status: string;
    memberSince: string;
    city: string | null;
    phone: string | null;
  };
  images: AdminListingImage[];
  attributes: Array<{ name: string; value: string }>;
}

export async function getAdminListings(params: AdminListingsParams = {}): Promise<AdminListingsResponse> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  return request(`/admin/listings?${qs.toString()}`);
}

export async function getAdminListing(id: string): Promise<AdminListingDetail> {
  return request(`/admin/listings/${id}`);
}

export async function updateAdminListing(
  id: string,
  payload: {
    title?: string;
    description?: string;
    categoryId?: string;
    priceAmount?: number;
    priceCurrency?: string;
    priceType?: string;
    isPriceFixed?: boolean;
    acceptsExchange?: boolean;
    condition?: string;
    listingType?: string;
    isAvailableNow?: boolean;
    allowsDelivery?: boolean;
    allowsPickup?: boolean;
    contactCityOverride?: string;
    showPhoneInListing?: boolean;
    sellerType?: string;
    businessPib?: string | null;
    businessName?: string | null;
    businessAddress?: string | null;
  },
): Promise<{ id: string; message: string }> {
  return request(`/admin/listings/${id}`, { method: 'PATCH', body: safeJsonStringify(payload) });
}

export async function updateAdminListingStatus(
  id: string,
  payload: { status: string; reason?: string },
): Promise<{ id: string; status: string }> {
  return request(`/admin/listings/${id}/status`, { method: 'PATCH', body: safeJsonStringify(payload) });
}

export async function updateAdminListingVisibility(
  id: string,
  payload: { isHidden: boolean; reason?: string },
): Promise<{ id: string; isHidden: boolean }> {
  return request(`/admin/listings/${id}/visibility`, { method: 'PATCH', body: safeJsonStringify(payload) });
}

export async function updateAdminListingPremium(
  id: string,
  payload: { isPremium: boolean; premiumExpiresAt?: string; reason?: string },
): Promise<{ id: string; isPremium: boolean; premiumExpiresAt: string | null }> {
  return request(`/admin/listings/${id}/premium`, { method: 'PATCH', body: safeJsonStringify(payload) });
}

export async function deleteAdminListing(id: string): Promise<{ id: string; deleted: boolean }> {
  return request(`/admin/listings/${id}`, { method: 'DELETE' });
}

export async function uploadAdminListingImage(
  listingId: string,
  file: File,
): Promise<{
  newImage: { id: string; url: string; fileKey: string; sortOrder: number };
  allImages: Array<{ id: string; url: string; fileKey: string; sortOrder: number }>;
}> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/admin/listings/${listingId}/images`, {
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
  return (body?.data !== undefined ? body.data : body) as { newImage: { id: string; url: string; fileKey: string; sortOrder: number }; allImages: Array<{ id: string; url: string; fileKey: string; sortOrder: number }> };
}

export async function deleteAdminListingImage(
  listingId: string,
  imageId: string,
): Promise<{
  deletedImageId: string;
  remainingImages: Array<{ id: string; url: string; fileKey: string; sortOrder: number }>;
}> {
  return request(`/admin/listings/${listingId}/images/${imageId}`, { method: 'DELETE' });
}

export async function reorderAdminListingImages(
  listingId: string,
  imageIds: string[],
): Promise<{
  success: boolean;
  images: Array<{ id: string; url: string; fileKey: string; sortOrder: number }>;
}> {
  return request(`/admin/listings/${listingId}/images/reorder`, {
    method: 'PATCH',
    body: safeJsonStringify({ imageIds }),
  });
}

// ── Admin Messages ────────────────────────────────────────────────────────────

export interface AdminMessageUser {
  id: string;
  displayName: string;
  email: string;
  username: string | null;
  phone: string | null;
  avatarUrl: string | null;
  conversationsCount: number;
  messagesCount: number;
  lastMessageAt: string | null;
}

export interface AdminMessageUsersResponse {
  data: AdminMessageUser[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface AdminConversationItem {
  id: string;
  listing: { id: string; title: string; slug: string } | null;
  participants: { id: string; displayName: string; email: string }[];
  otherParticipant: { id: string; displayName: string; email: string };
  lastMessage: { id: string; bodyPreview: string; createdAt: string; senderId: string } | null;
  messagesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserConversationsResponse {
  user: { id: string; displayName: string; email: string };
  data: AdminConversationItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface AdminConversationMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface AdminConversationDetail {
  id: string;
  listing: { id: string; title: string; slug: string; thumbnailUrl: string | null } | null;
  participants: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  }[];
  messages: AdminConversationMessage[];
  messagesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminConversationMessagesResponse {
  conversationId: string;
  buyerId: string;
  sellerId: string;
  messages: AdminConversationMessage[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface AdminMessageUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AdminConversationsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface AdminMessagesParams {
  page?: number;
  limit?: number;
}

export async function getAdminMessageUsers(
  params: AdminMessageUsersParams = {},
): Promise<AdminMessageUsersResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.search) q.set('search', params.search);
  if (params.sortBy) q.set('sortBy', params.sortBy);
  if (params.sortOrder) q.set('sortOrder', params.sortOrder);
  const qs = q.toString();
  return request(`/admin/messages/users${qs ? `?${qs}` : ''}`);
}

export async function getAdminUserConversations(
  userId: string,
  params: AdminConversationsParams = {},
): Promise<AdminUserConversationsResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.search) q.set('search', params.search);
  const qs = q.toString();
  return request(`/admin/messages/users/${userId}/conversations${qs ? `?${qs}` : ''}`);
}

export async function getAdminConversation(
  conversationId: string,
): Promise<AdminConversationDetail> {
  return request(`/admin/messages/conversations/${conversationId}`);
}

export async function getAdminConversationMessages(
  conversationId: string,
  params: AdminMessagesParams = {},
): Promise<AdminConversationMessagesResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return request(`/admin/messages/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`);
}

// ── Reports / Moderation ─────────────────────────────────────────────────────

export type ReportStatus = 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
export type ReportReason = 'WRONG_CATEGORY' | 'DUPLICATE_LISTING' | 'SPAM' | 'VIOLATES_RULES';

export interface AdminReport {
  id: string;
  reason: ReportReason;
  message: string | null;
  status: ReportStatus;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  listing: {
    id: string;
    slug: string;
    title: string;
    status: string;
    isHidden: boolean;
  } | null;
  reporter: { id: string; email: string; displayName: string | null; avatarUrl: string | null } | null;
  seller: { id: string; email: string; displayName: string | null; avatarUrl: string | null } | null;
  resolvedBy: { id: string; email: string } | null;
}

export interface AdminReportsResponse {
  items: AdminReport[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AdminReportsParams {
  page?: number;
  limit?: number;
  status?: ReportStatus;
  reason?: ReportReason;
  search?: string;
}

export async function getAdminReports(params: AdminReportsParams = {}): Promise<AdminReportsResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  if (params.reason) q.set('reason', params.reason);
  if (params.search) q.set('search', params.search);
  const qs = q.toString();
  return request(`/admin/reports${qs ? `?${qs}` : ''}`);
}

export async function getAdminReport(id: string): Promise<AdminReport> {
  return request(`/admin/reports/${id}`);
}

export async function updateAdminReportStatus(
  id: string,
  data: { status: ReportStatus; adminNote?: string },
): Promise<AdminReport> {
  return request(`/admin/reports/${id}/status`, {
    method: 'PATCH',
    body: safeJsonStringify(data),
  });
}

export async function adminHideListing(id: string, data: { adminNote?: string }): Promise<AdminReport> {
  return request(`/admin/reports/${id}/actions/hide-listing`, {
    method: 'POST',
    body: safeJsonStringify(data),
  });
}

export async function adminSuspendListing(id: string, data: { adminNote?: string }): Promise<AdminReport> {
  return request(`/admin/reports/${id}/actions/suspend-listing`, {
    method: 'POST',
    body: safeJsonStringify(data),
  });
}

export async function adminDeleteListing(id: string, data: { adminNote?: string }): Promise<AdminReport> {
  return request(`/admin/reports/${id}/actions/delete-listing`, {
    method: 'POST',
    body: safeJsonStringify(data),
  });
}

export async function adminRejectReport(id: string, data: { adminNote?: string }): Promise<AdminReport> {
  return request(`/admin/reports/${id}/actions/reject`, {
    method: 'POST',
    body: safeJsonStringify(data),
  });
}

// ── Admin Credits ─────────────────────────────────────────────────────────────

export interface AdminCreditOverview {
  totalCreditsAdded: number;
  totalCreditsSpent: number;
  totalCreditsUnused: number;
  usersWithCredits: number;
  totalTopUpsCount: number;
  pendingTopUpsCount: number;
  confirmedTopUpsCount: number;
  totalRevenueAmount: number;
  revenueCurrency: string;
}

export interface AdminCreditUser {
  userId: string;
  displayName: string;
  email: string;
  phone: string | null;
  balance: number;
  totalAdded: number;
  totalSpent: number;
  lastTransactionAt: string | null;
}

export interface AdminCreditTransaction {
  id: string;
  user: { id: string; displayName: string; email: string };
  type: string;
  reason: string;
  amount: number;
  balanceBefore: number | null;
  balanceAfter: number;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  adminId: string | null;
  createdAt: string;
}

export interface AdminCreditTopUp {
  id: string;
  user: { id: string; displayName: string; email: string };
  method: string;
  status: string;
  creditsAmount: number;
  currency: string;
  referenceCode: string | null;
  adminNote: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export interface AdminCreditUserDetail {
  user: { id: string; displayName: string; email: string; phone: string | null };
  balance: number;
  totalAdded: number;
  totalSpent: number;
  recentTransactions: AdminCreditTransaction[];
  recentTopUps: AdminCreditTopUp[];
}

interface AdminMeta { page: number; limit: number; total: number; totalPages: number }

export async function getAdminCreditOverview(): Promise<AdminCreditOverview> {
  return request('/admin/credits/overview');
}

export async function getAdminCreditUsers(params?: {
  page?: number; limit?: number; search?: string;
  minBalance?: number; maxBalance?: number;
}): Promise<{ data: AdminCreditUser[]; meta: AdminMeta }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.search) qs.set('search', params.search);
  if (params?.minBalance !== undefined) qs.set('minBalance', String(params.minBalance));
  if (params?.maxBalance !== undefined) qs.set('maxBalance', String(params.maxBalance));
  return request(`/admin/credits/users?${qs}`);
}

export async function getAdminCreditUser(userId: string): Promise<AdminCreditUserDetail> {
  return request(`/admin/credits/users/${userId}`);
}

export async function getAdminCreditUserTransactions(
  userId: string,
  params?: { page?: number; limit?: number },
): Promise<{ data: AdminCreditTransaction[]; meta: AdminMeta }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  return request(`/admin/credits/users/${userId}/transactions?${qs}`);
}

export async function getAdminCreditTransactions(params?: {
  page?: number; limit?: number; userId?: string;
  type?: string; reason?: string; dateFrom?: string; dateTo?: string;
}): Promise<{ data: AdminCreditTransaction[]; meta: AdminMeta }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.userId) qs.set('userId', params.userId);
  if (params?.type) qs.set('type', params.type);
  if (params?.reason) qs.set('reason', params.reason);
  if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params?.dateTo) qs.set('dateTo', params.dateTo);
  return request(`/admin/credits/transactions?${qs}`);
}

export async function getAdminCreditTopUps(params?: {
  page?: number; limit?: number; userId?: string;
  method?: string; status?: string; dateFrom?: string; dateTo?: string;
}): Promise<{ data: AdminCreditTopUp[]; meta: AdminMeta }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.userId) qs.set('userId', params.userId);
  if (params?.method) qs.set('method', params.method);
  if (params?.status) qs.set('status', params.status);
  if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params?.dateTo) qs.set('dateTo', params.dateTo);
  return request(`/admin/credits/top-ups?${qs}`);
}

export async function updateAdminCreditTopUpStatus(
  id: string,
  data: { status: 'CONFIRMED' | 'REJECTED'; adminNote?: string },
): Promise<AdminCreditTopUp> {
  return request(`/admin/credits/top-ups/${id}/status`, {
    method: 'PATCH',
    body: safeJsonStringify(data),
  });
}

export async function adjustAdminUserCredits(
  userId: string,
  data: { amount: number; reason: string },
): Promise<{ balanceBefore: number; balanceAfter: number }> {
  return request(`/admin/credits/users/${userId}/adjust`, {
    method: 'POST',
    body: safeJsonStringify(data),
  });
}

// ── Admin Settings ────────────────────────────────────────────────────────────

export interface PlatformSettingItem {
  id: string;
  key: string;
  value: string;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  group: string;
  description: string | null;
  isPublic: boolean;
  updatedAt: string;
}

export type SettingsGrouped = Record<string, PlatformSettingItem[]>;

export async function getAdminSettings(): Promise<SettingsGrouped> {
  return request('/settings');
}

export async function getAdminSettingsGroup(group: string): Promise<PlatformSettingItem[]> {
  return request(`/settings/${group}`);
}

export async function updateAdminSettingsGroup(
  group: string,
  settings: { key: string; value: string }[],
): Promise<PlatformSettingItem[]> {
  return request<PlatformSettingItem[]>(`/settings/${group}`, {
    method: 'PUT',
    body: safeJsonStringify({ settings }),
  });
}

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  password?: string;
  fromEmail: string;
  fromName: string;
  secure: boolean;
}

export async function getSmtpSettings(): Promise<Partial<SmtpSettings>> {
  return request('/settings/smtp');
}

export async function updateSmtpSettings(data: SmtpSettings): Promise<{ success: boolean; message?: string }> {
  return request('/settings/smtp', {
    method: 'PUT',
    body: safeJsonStringify(data),
  });
}

export async function testSmtpConnection(): Promise<{ success: boolean; message?: string }> {
  return request('/settings/smtp/test', { method: 'POST' });
}

export interface ImapSettings {
  host: string;
  port: number;
  user: string;
  password?: string;
  tls: boolean;
}

export async function getImapSettings(): Promise<Partial<ImapSettings>> {
  return request('/settings/imap');
}

export async function updateImapSettings(data: ImapSettings): Promise<{ success: boolean; message?: string }> {
  return request('/settings/imap', {
    method: 'PUT',
    body: safeJsonStringify(data),
  });
}

export interface WorkingHoursDay {
  dayOfWeek: number;
  dayName: string;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface WorkingHoursDisplayRow {
  days: string;
  hours: string;
  isOpen: boolean;
  note: string | null;
}

export async function getWorkingHours(): Promise<WorkingHoursDay[]> {
  return request('/working-hours');
}

export async function getWorkingHoursDisplay(): Promise<WorkingHoursDisplayRow[]> {
  return request('/working-hours/display');
}

export async function updateWorkingHours(days: WorkingHoursDay[]): Promise<{ success: boolean; message?: string }> {
  return request('/working-hours', {
    method: 'PUT',
    body: safeJsonStringify(days),
  });
}

export async function updateWorkingHoursDay(
  dayOfWeek: number | string,
  data: { isOpen: boolean; openTime: string | null; closeTime: string | null },
): Promise<{ success: boolean; message?: string }> {
  return request(`/working-hours/${dayOfWeek}`, {
    method: 'PUT',
    body: safeJsonStringify(data),
  });
}

export async function exportEmails(format: 'csv' | 'excel'): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}/export/emails?format=${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const ext = format === 'excel' ? 'xlsx' : 'csv';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `email-adrese.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface FooterSettings {
  description: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  tiktokUrl: string;
  street: string;
  city: string;
  phone: string;
  email: string;
  pib: string;
  mb: string;
}

type RawFooterSettings = Partial<FooterSettings> &
  Record<string, unknown> |
  PlatformSettingItem[] |
  { settings?: unknown; footer?: unknown; data?: unknown };

const FOOTER_DEFAULTS: FooterSettings = {
  description: '',
  facebookUrl: '',
  instagramUrl: '',
  twitterUrl: '',
  tiktokUrl: '',
  street: '',
  city: '',
  phone: '',
  email: '',
  pib: '',
  mb: '',
};

const FOOTER_KEY_MAP: Record<string, keyof FooterSettings> = {
  description: 'description',
  footerdescription: 'description',
  footertext: 'description',
  footerdesc: 'description',
  opis: 'description',
  facebookurl: 'facebookUrl',
  facebook: 'facebookUrl',
  facebooklink: 'facebookUrl',
  instagramurl: 'instagramUrl',
  instagram: 'instagramUrl',
  instagramlink: 'instagramUrl',
  twitterurl: 'twitterUrl',
  twitter: 'twitterUrl',
  twitterlink: 'twitterUrl',
  xurl: 'twitterUrl',
  xlink: 'twitterUrl',
  tiktokurl: 'tiktokUrl',
  tiktok: 'tiktokUrl',
  tiktoklink: 'tiktokUrl',
  street: 'street',
  address: 'street',
  companyaddress: 'street',
  companystreet: 'street',
  contactaddress: 'street',
  adresa: 'street',
  ulica: 'street',
  city: 'city',
  companycity: 'city',
  contactcity: 'city',
  grad: 'city',
  phone: 'phone',
  telephone: 'phone',
  phonenumber: 'phone',
  contactphone: 'phone',
  companyphone: 'phone',
  brojtelefona: 'phone',
  email: 'email',
  emailaddress: 'email',
  contactemail: 'email',
  companyemail: 'email',
  pib: 'pib',
  companypib: 'pib',
  mb: 'mb',
  companymb: 'mb',
  maticnibroj: 'mb',
};

function footerKey(key: string): keyof FooterSettings | null {
  const bare = key.split('.').pop() ?? key;
  const normalized = bare.replace(/[_\-\s]/g, '').toLowerCase();
  return FOOTER_KEY_MAP[normalized] ?? null;
}

function readFooterSource(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const record = raw as { data?: unknown; footer?: unknown; settings?: unknown };
  return record.data ?? record.footer ?? record.settings ?? raw;
}

function normalizeFooterSettings(raw: unknown): FooterSettings {
  const source = readFooterSource(raw);
  const normalized: FooterSettings = { ...FOOTER_DEFAULTS };

  if (Array.isArray(source)) {
    for (const item of source) {
      if (!item || typeof item !== 'object') continue;
      const record = item as { key?: unknown; value?: unknown };
      if (typeof record.key !== 'string') continue;
      const key = footerKey(record.key);
      if (!key) continue;
      normalized[key] = record.value == null ? '' : String(record.value);
    }
    return normalized;
  }

  if (source && typeof source === 'object') {
    for (const [rawKey, rawValue] of Object.entries(source as Record<string, unknown>)) {
      const key = footerKey(rawKey);
      if (!key) continue;
      normalized[key] = rawValue == null ? '' : String(rawValue);
    }
  }

  return normalized;
}

function hasFooterValues(settings: FooterSettings): boolean {
  return Object.values(settings).some((value) => value.trim() !== '');
}

export async function getFooterSettings(): Promise<FooterSettings> {
  const data = await request<RawFooterSettings>('/settings/footer');
  const direct = normalizeFooterSettings(data);
  if (hasFooterValues(direct)) return direct;

  const grouped = await request<SettingsGrouped>('/settings');
  return normalizeFooterSettings(grouped.footer ?? grouped.Footer ?? grouped);
}

export async function updateFooterSettings(
  data: FooterSettings,
): Promise<{ success: boolean; message?: string }> {
  return request('/settings/footer', {
    method: 'PUT',
    body: safeJsonStringify(data),
  });
}

// ── Atributi ──────────────────────────────────────────────────────────────────

export interface AttributeValue {
  id: string;
  value: string;
  sortOrder: number;
}

export interface Attribute {
  id: string;
  name: string;
  values: AttributeValue[];
  createdAt: string;
}

export async function getAttributes(): Promise<Attribute[]> {
  return request('/attributes');
}

export async function createAttribute(name: string): Promise<Attribute> {
  return request('/attributes', { method: 'POST', body: safeJsonStringify({ name }) });
}

export async function updateAttribute(id: string, name: string): Promise<Attribute> {
  return request(`/attributes/${id}`, { method: 'PUT', body: safeJsonStringify({ name }) });
}

export async function deleteAttribute(id: string): Promise<void> {
  return request(`/attributes/${id}`, { method: 'DELETE' });
}

export async function createAttributeValue(attributeId: string, value: string): Promise<AttributeValue> {
  return request(`/attributes/${attributeId}/values`, { method: 'POST', body: safeJsonStringify({ value }) });
}

export async function updateAttributeValue(attributeId: string, valueId: string, value: string): Promise<AttributeValue> {
  return request(`/attributes/${attributeId}/values/${valueId}`, { method: 'PUT', body: safeJsonStringify({ value }) });
}

export async function deleteAttributeValue(attributeId: string, valueId: string): Promise<void> {
  return request(`/attributes/${attributeId}/values/${valueId}`, { method: 'DELETE' });
}

// ── Uvoz (Import) ─────────────────────────────────────────────────────────────

export interface SupplierConfig {
  id: string;
  name: string;
  type: 'CSV' | 'API' | string;
  url?: string;
  apiUrl?: string;
  encoding?: string;
  delimiter?: string;
  columnMapping?: Record<string, string>;
  headers?: Record<string, string> | string;
  apiHeaders?: Record<string, string> | string;
  isActive: boolean;
  createdAt: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface MinottiB2BFilters {
  brands: string[];
  categories: string[];
  subcategories: string[];
}

export interface MinottiCatalogStructure {
  brands: string[];
  categories: string[];
  subcategories: Record<string, string[]>;
}

export interface MinottiB2BImportOptions {
  brands?: string[];
  categories?: string[];
  subcategories?: string[];
  pageSize?: number;
  includeDetails?: boolean;
  replaceImages?: boolean;
}

type RawMinottiB2BFilters = Partial<Record<'brands' | 'brand' | 'categories' | 'category' | 'subcategories' | 'subcategory' | 'filters', unknown>>;

function normalizeFilterList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const candidate = record.name ?? record.value ?? record.label ?? record.title;
        return typeof candidate === 'string' ? candidate : '';
      }
      return '';
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'sr-Latn-RS'));
}

function normalizeMinottiB2BFilters(filters: RawMinottiB2BFilters): MinottiB2BFilters {
  const source = filters.filters && typeof filters.filters === 'object'
    ? filters.filters as RawMinottiB2BFilters
    : filters;

  return {
    brands: normalizeFilterList(source.brands ?? source.brand),
    categories: normalizeFilterList(source.categories ?? source.category),
    subcategories: normalizeFilterList(source.subcategories ?? source.subcategory),
  };
}

export async function getSuppliers(): Promise<SupplierConfig[]> {
  return request('/import/suppliers');
}

export async function createSupplier(payload: Omit<SupplierConfig, 'id' | 'createdAt'>): Promise<SupplierConfig> {
  return request('/import/suppliers', { method: 'POST', body: safeJsonStringify(payload) });
}

export async function updateSupplier(id: string, payload: Partial<Omit<SupplierConfig, 'id' | 'createdAt'>>): Promise<SupplierConfig> {
  return request(`/import/suppliers/${id}`, { method: 'PUT', body: safeJsonStringify(payload) });
}

export async function deleteSupplier(id: string): Promise<void> {
  return request(`/import/suppliers/${id}`, { method: 'DELETE' });
}

export async function runCsvImport(supplierId: string, file: File): Promise<ImportResult> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/import/suppliers/${supplierId}/run-csv`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.message ?? `HTTP ${res.status}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
  }
  return (body.data ?? body) as ImportResult;
}

export async function getMinottiB2BFilters(supplierId: string): Promise<MinottiB2BFilters> {
  const filters = await request<RawMinottiB2BFilters>(`/import/suppliers/${supplierId}/minotti-b2b/filters`);
  return normalizeMinottiB2BFilters(filters);
}

export async function getMinottiB2BCatalogStructure(supplierId: string): Promise<MinottiCatalogStructure> {
  const res = await request<{ brands: string[]; categories: string[]; subcategories: Record<string, string[]> }>(
    `/import/suppliers/${supplierId}/minotti-b2b/catalog-structure`,
  );
  return {
    brands: Array.isArray(res.brands) ? res.brands : [],
    categories: Array.isArray(res.categories) ? res.categories : [],
    subcategories: res.subcategories && typeof res.subcategories === 'object' && !Array.isArray(res.subcategories)
      ? res.subcategories
      : {},
  };
}

export async function runApiImport(supplierId: string, options?: MinottiB2BImportOptions): Promise<ImportResult> {
  return request(`/import/suppliers/${supplierId}/run-api`, {
    method: 'POST',
    body: options ? safeJsonStringify(options) : undefined,
  });
}

export async function runMinottiB2BImport(supplierId: string, options: MinottiB2BImportOptions): Promise<ImportResult> {
  return request(`/import/suppliers/${supplierId}/run-minotti-b2b`, {
    method: 'POST',
    body: safeJsonStringify(options),
  });
}
