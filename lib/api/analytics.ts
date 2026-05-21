const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

async function request<T>(path: string): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { headers });

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

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year';

export interface AnalyticsMetric {
  value: number;
  change: number;
}

export interface AnalyticsDayRevenue {
  date: string;
  revenue: number;
  ordersCount: number;
}

export interface AnalyticsTopProduct {
  id: string;
  name: string;
  category: string | null;
  soldCount: number;
  revenue: number;
}

export interface AnalyticsRecentOrder {
  id: string;
  orderNumber: string;
  customer: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

export interface AnalyticsCategoryRevenue {
  id: string;
  name: string;
  productsCount: number;
  ordersCount: number;
  revenue: number;
  percentage?: number;
}

export interface AnalyticsOrdersByStatus {
  status: string;
  count: number;
}

export interface AnalyticsData {
  period: AnalyticsPeriod;
  dateRange: { from: string; to: string };
  summary: {
    totalRevenue: AnalyticsMetric;
    ordersCount: AnalyticsMetric;
    averageOrderValue: AnalyticsMetric;
    newUsersCount?: AnalyticsMetric;
    newCustomers?: AnalyticsMetric;
  };
  revenueByDay?: AnalyticsDayRevenue[];
  ordersByStatus?: AnalyticsOrdersByStatus[];
  topProducts?: AnalyticsTopProduct[];
  recentOrders?: AnalyticsRecentOrder[];
  revenueByCategory?: AnalyticsCategoryRevenue[];
}

// ── API ───────────────────────────────────────────────────────────────────────

export interface AnalyticsParams {
  period?: AnalyticsPeriod;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

export async function getAnalytics(params: AnalyticsParams = {}): Promise<AnalyticsData> {
  const qs = new URLSearchParams();
  if (params.from && params.to) {
    qs.set('from', params.from);
    qs.set('to', params.to);
  } else {
    qs.set('period', params.period ?? 'month');
  }
  return request<AnalyticsData>(`/analytics?${qs.toString()}`);
}
