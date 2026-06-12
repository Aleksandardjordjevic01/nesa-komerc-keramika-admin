'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Search, ChevronLeft, ChevronRight, Eye, Pencil, Loader2, X, CreditCard } from 'lucide-react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import { SelectDropdown } from '../../../components/shared/select-dropdown';
import { getOrders, type Order, type OrderStatus, type PaymentStatus, type OrdersParams } from '../../../lib/api/client';

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Na čekanju', confirmed: 'Potvrđena', processing: 'U obradi',
  shipped: 'Poslata', delivered: 'Isporučena', cancelled: 'Otkazana',
};

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  processing: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  shipped: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
  delivered: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  cancelled: 'bg-red-50 text-red-600 ring-1 ring-red-200',
};

const ORDER_STATUS_DOT: Record<OrderStatus, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-blue-500',
  processing: 'bg-purple-500',
  shipped: 'bg-cyan-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Nije plaćeno', paid: 'Plaćeno', refunded: 'Refundirano',
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  paid: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  refunded: 'bg-muted text-muted-foreground ring-1 ring-border',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Kartica', invoice: 'Faktura', cash_on_delivery: 'Pouzećem',
};

function formatPrice(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS', { style: 'currency', currency: 'RSD', maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCustomerName(order: Order) {
  const name = `${order.user?.firstName ?? ''} ${order.user?.lastName ?? ''}`.trim();
  return name || order.user?.email || '—';
}


export default function NarudzbinePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: OrdersParams = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter as OrderStatus;
      if (paymentFilter) params.paymentStatus = paymentFilter as PaymentStatus;
      const res = await getOrders(params);
      setOrders(res.data); setMeta(res.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Greška');
    } finally { setLoading(false); }
  }, [page, search, statusFilter, paymentFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Narudžbine
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{meta.total} narudžbina ukupno</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Pretraži po broju narudžbine..."
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            )}
          </div>
          <SelectDropdown
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[{ value: '', label: 'Svi statusi' }, ...Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
            className="w-44"
          />
          <SelectDropdown
            value={paymentFilter}
            onChange={(v) => { setPaymentFilter(v); setPage(1); }}
            options={[{ value: '', label: 'Sve uplate' }, ...Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
            className="w-40"
          />
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive text-sm">{error}</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ShoppingCart className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nema narudžbina.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase w-[15%]">Narudžbina</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase w-[20%]">Kupac</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase w-[15%]">Adresa</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase w-[13%]">Iznos</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase w-[14%]">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase w-[13%]">Uplata</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase w-[10%]">Akcije</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/20 transition-colors group">

                      {/* Narudžbina */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-xs font-semibold text-foreground">{o.orderNumber}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{formatDate(o.createdAt)}</div>
                      </td>

                      {/* Kupac */}
                      <td className="px-4 py-3.5">
                        <div className="text-sm font-medium text-foreground truncate max-w-[200px]">{formatCustomerName(o)}</div>
                        {o.user?.email && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">{o.user.email}</div>
                        )}
                      </td>

                      {/* Adresa */}
                      <td className="px-4 py-3.5">
                        <div className="text-sm text-foreground truncate max-w-[160px]">{o.shippingCity || '—'}</div>
                        {o.shippingAddress && (
                          <div className="text-xs text-muted-foreground truncate max-w-[160px] mt-0.5">{o.shippingAddress}</div>
                        )}
                      </td>

                      {/* Iznos */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="text-sm font-semibold text-foreground whitespace-nowrap">{formatPrice(o.totalAmount)}</div>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <CreditCard className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{PAYMENT_METHOD_LABELS[o.paymentMethod] ?? o.paymentMethod}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[o.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ORDER_STATUS_DOT[o.status]}`} />
                          {ORDER_STATUS_LABELS[o.status]}
                        </span>
                      </td>

                      {/* Uplata */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLORS[o.paymentStatus]}`}>
                          {PAYMENT_STATUS_LABELS[o.paymentStatus]}
                        </span>
                      </td>

                      {/* Akcije */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => router.push(`/dashboard/narudzbine/${o.id}`)}
                            title="Pregled"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/narudzbine/${o.id}?edit=true`)}
                            title="Izmeni"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
              <span className="text-xs text-muted-foreground">
                Strana {meta.page} od {meta.totalPages} · {meta.total} narudžbina
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={meta.page <= 1}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={meta.page >= meta.totalPages}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </DashboardLayout>
  );
}
