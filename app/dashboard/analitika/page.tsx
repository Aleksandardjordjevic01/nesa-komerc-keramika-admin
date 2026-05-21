'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart2, TrendingUp, ShoppingCart, Users, DollarSign, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import {
  getAnalytics,
  type AnalyticsData,
  type AnalyticsPeriod,
  type AnalyticsParams,
} from '../../../lib/api/analytics';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRSD(value: number) {
  return new Intl.NumberFormat('sr-Latn-RS', { style: 'currency', currency: 'RSD', maximumFractionDigits: 0 }).format(value);
}

function formatChange(change: number) {
  const abs = Math.abs(change).toFixed(1);
  return `${change >= 0 ? '+' : ''}${abs}%`;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Na čekanju',
  confirmed: 'Potvrđena',
  processing: 'U obradi',
  shipped: 'Poslata',
  delivered: 'Isporučena',
  cancelled: 'Otkazana',
  refunded: 'Refundirana',
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-muted text-muted-foreground',
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  change?: number;
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-foreground">{value}</p>
        )}
      </div>
      {change !== undefined && !loading && (
        <div className={`flex items-center gap-1 text-xs font-medium ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {change >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {formatChange(change)} u odnosu na prethodni period
        </div>
      )}
    </div>
  );
}

// ── Mini bar chart (CSS-based) ─────────────────────────────────────────────────

function RevenueBarChart({ data }: { data: Array<{ date: string; revenue: number; ordersCount: number }> }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="flex items-end gap-0.5 h-full w-full">
      {data.map((d) => {
        const pct = Math.max((d.revenue / max) * 100, 2);
        const label = new Date(d.date).toLocaleDateString('sr-Latn-RS', { day: '2-digit', month: 'short' });
        return (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center gap-0.5 group relative"
            title={`${label}: ${formatRSD(d.revenue)} (${d.ordersCount} narudžbina)`}
          >
            <div
              className="w-full rounded-t-sm bg-primary/70 group-hover:bg-primary transition-colors"
              style={{ height: `${pct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: 'Danas', value: 'today' },
  { label: 'Ova nedelja', value: 'week' },
  { label: 'Ovaj mesec', value: 'month' },
  { label: 'Ova godina', value: 'year' },
];

export default function AnalitikaPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // When custom dates are both set, they override period
  const params: AnalyticsParams = fromDate && toDate
    ? { from: fromDate, to: toDate }
    : { period };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getAnalytics(params);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Nije moguće učitati analitiku.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, fromDate, toDate]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  function handlePeriodClick(value: AnalyticsPeriod) {
    setPeriod(value);
    setFromDate('');
    setToDate('');
  }

  function handleApplyDates() {
    if (fromDate && toDate) void fetchData();
  }

  function handleClearDates() {
    setFromDate('');
    setToDate('');
  }

  const summary = data?.summary;
  const newUsers = summary?.newUsersCount ?? summary?.newCustomers;
  const usingCustomRange = !!(fromDate && toDate);

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              Analitika
            </h1>
            {data && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {new Date(data.dateRange.from).toLocaleDateString('sr-Latn-RS', { day: '2-digit', month: 'long', year: 'numeric' })}
                {' — '}
                {new Date(data.dateRange.to).toLocaleDateString('sr-Latn-RS', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mt-0.5" />}
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Period buttons */}
          <div className="flex items-center gap-1.5">
            {PERIODS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => handlePeriodClick(value)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  !usingCustomRange && period === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted border border-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-10 w-px bg-border hidden sm:block" />

          {/* Date range inputs */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Od:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Do:</label>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {fromDate && toDate && (
              <button
                onClick={handleClearDates}
                className="px-2.5 py-2.5 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Resetuj
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Ukupan prihod"
            value={summary ? formatRSD(summary.totalRevenue.value) : '—'}
            change={summary?.totalRevenue.change}
            icon={DollarSign}
            loading={loading}
          />
          <KpiCard
            label="Broj narudžbina"
            value={summary ? String(summary.ordersCount.value) : '—'}
            change={summary?.ordersCount.change}
            icon={ShoppingCart}
            loading={loading}
          />
          <KpiCard
            label="Prosečna vrednost"
            value={summary ? formatRSD(summary.averageOrderValue.value) : '—'}
            change={summary?.averageOrderValue.change}
            icon={TrendingUp}
            loading={loading}
          />
          <KpiCard
            label="Novi korisnici"
            value={newUsers ? String(newUsers.value) : '—'}
            change={newUsers?.change}
            icon={Users}
            loading={loading}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue by day */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-foreground">Prihod po danima</h3>
            {loading ? (
              <div className="h-52 bg-muted rounded-lg animate-pulse" />
            ) : data?.revenueByDay && data.revenueByDay.length > 0 ? (
              <div className="h-52 px-1 pt-2">
                <RevenueBarChart data={data.revenueByDay} />
              </div>
            ) : (
              <div className="h-52 rounded-lg bg-muted/40 border border-dashed border-border flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Nema podataka za izabrani period</p>
              </div>
            )}
          </div>

          {/* Orders by status */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-foreground">Narudžbine po statusu</h3>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : data?.ordersByStatus && data.ordersByStatus.length > 0 ? (
              <div className="space-y-2">
                {data.ordersByStatus.map((item) => {
                  const total = data.ordersByStatus!.reduce((s, i) => s + i.count, 0);
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.status} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${ORDER_STATUS_COLORS[item.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {ORDER_STATUS_LABELS[item.status] ?? item.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-foreground w-6 text-right">{item.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-52 rounded-lg bg-muted/40 border border-dashed border-border flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Nema podataka</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top products */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Najprodavaniji proizvodi</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Proizvod', 'Kategorija', 'Prodato', 'Prihod'].map((col) => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-3 bg-muted rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : data?.topProducts && data.topProducts.length > 0 ? (
                  data.topProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground truncate max-w-[160px]">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.category ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.soldCount}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{formatRSD(p.revenue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">Nema podataka</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Recent orders */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Poslednje narudžbine</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Broj', 'Kupac', 'Iznos', 'Status'].map((col) => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-3 bg-muted rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : data?.recentOrders && data.recentOrders.length > 0 ? (
                  data.recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{o.orderNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">{o.customer}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{formatRSD(o.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[o.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {ORDER_STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">Nema podataka</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue by category */}
        {(loading || (data?.revenueByCategory && data.revenueByCategory.length > 0)) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Prihod po kategorijama</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Kategorija', 'Narudžbina', 'Prihod', 'Udeo'].map((col) => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-3 bg-muted rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : (
                  data!.revenueByCategory!.map((cat) => (
                    <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{cat.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{cat.ordersCount}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{formatRSD(cat.revenue)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${cat.percentage ?? 0}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{(cat.percentage ?? 0).toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

