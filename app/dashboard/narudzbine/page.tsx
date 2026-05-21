'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShoppingCart, Search, ChevronLeft, ChevronRight, Eye, Loader2, X } from 'lucide-react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import { SelectDropdown } from '../../../components/shared/select-dropdown';
import { getOrders, getOrder, updateOrderStatus, updateOrderPaymentStatus, type Order, type OrderStatus, type PaymentStatus, type OrdersParams } from '../../../lib/api/client';

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Na čekanju', confirmed: 'Potvrđena', processing: 'U obradi',
  shipped: 'Poslata', delivered: 'Isporučena', cancelled: 'Otkazana',
};

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  processing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  shipped: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Nije plaćeno', paid: 'Plaćeno', refunded: 'Refundirano',
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  refunded: 'bg-muted text-muted-foreground',
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

export default function NarudzbinePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: OrdersParams = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter as OrderStatus;
      if (paymentFilter) params.paymentStatus = paymentFilter as PaymentStatus;
      const res = await getOrders(params);
      setOrders(res.data); setMeta(res.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Greška');
    } finally { setLoading(false); }
  }, [page, statusFilter, paymentFilter]);

  useEffect(() => { load(); }, [load]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    try { setSelected(await getOrder(id)); }
    catch { /* ignore */ }
    finally { setDetailLoading(false); }
  }

  async function handleStatusChange(id: string, status: OrderStatus) {
    try { const o = await updateOrderStatus(id, status); setSelected(o); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Greška'); }
  }

  async function handlePaymentChange(id: string, ps: PaymentStatus) {
    try { const o = await updateOrderPaymentStatus(id, ps); setSelected(o); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Greška'); }
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Narudžbine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{meta.total} narudžbina ukupno</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Pretraži po broju narudžbine..."
              className="w-full pl-9 pr-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
            {searchInput && <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground" /></button>}
          </div>
          <SelectDropdown value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[{ value: '', label: 'Svi statusi' }, ...Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
            className="w-44" />
          <SelectDropdown value={paymentFilter} onChange={(v) => { setPaymentFilter(v); setPage(1); }}
            options={[{ value: '', label: 'Sve uplate' }, ...Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
            className="w-40" />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nema narudžbina.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">BROJ</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">KUPAC</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">IZNOS</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">STATUS</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">UPLATA</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">DATUM</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">AKCIJE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{o.orderNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{o.user?.firstName} {o.user?.lastName}</div>
                        <div className="text-xs text-muted-foreground">{o.user?.email}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">{formatPrice(o.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[o.status]}`}>
                          {ORDER_STATUS_LABELS[o.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLORS[o.paymentStatus]}`}>
                          {PAYMENT_STATUS_LABELS[o.paymentStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(o.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button onClick={() => openDetail(o.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Detalji">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-sm text-muted-foreground">Strana {meta.page} od {meta.totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={meta.page <= 1}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={meta.page >= meta.totalPages}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {(selected || detailLoading) && (
        <div className="fixed inset-0 bg-black/50 flex justify-end z-50" onClick={() => setSelected(null)}>
          <div className="bg-card w-full max-w-lg h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Narudžbina {selected?.orderNumber}</h2>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            {detailLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : selected && (
              <div className="p-6 space-y-6">
                {/* Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status narudžbine</label>
                    <select value={selected.status} onChange={(e) => handleStatusChange(selected.id, e.target.value as OrderStatus)}
                      className="mt-1 w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
                      {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status uplate</label>
                    <select value={selected.paymentStatus} onChange={(e) => handlePaymentChange(selected.id, e.target.value as PaymentStatus)}
                      className="mt-1 w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
                      {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* Kupac */}
                <div className="bg-muted/30 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-2">Kupac</h3>
                  <p className="text-sm">{selected.user?.firstName} {selected.user?.lastName}</p>
                  <p className="text-sm text-muted-foreground">{selected.user?.email}</p>
                  {selected.user?.phone && <p className="text-sm text-muted-foreground">{selected.user.phone}</p>}
                </div>

                {/* Adresa */}
                <div className="bg-muted/30 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-2">Adresa dostave</h3>
                  <p className="text-sm">{selected.shippingAddress}</p>
                  <p className="text-sm">{selected.shippingZipCode} {selected.shippingCity}</p>
                  <p className="text-sm text-muted-foreground">{selected.shippingCountry}</p>
                  {selected.companyName && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-sm font-medium">{selected.companyName}</p>
                      {selected.pib && <p className="text-xs text-muted-foreground">PIB: {selected.pib}</p>}
                    </div>
                  )}
                </div>

                {/* Proizvodi */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Proizvodi</h3>
                  <div className="space-y-2">
                    {selected.items?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">Kol: {item.quantity} × {formatPrice(item.unitPrice)}</p>
                        </div>
                        <p className="text-sm font-medium">{formatPrice(item.totalPrice)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sumiranje */}
                <div className="bg-muted/30 rounded-xl p-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Međuzbir</span><span>{formatPrice(selected.subtotalAmount)}</span></div>
                  {selected.discountAmount > 0 && <div className="flex justify-between text-primary"><span>Popust{selected.couponCode ? ` (${selected.couponCode})` : ''}</span><span>-{formatPrice(selected.discountAmount)}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Dostava</span><span>{selected.shippingCost > 0 ? formatPrice(selected.shippingCost) : 'Besplatno'}</span></div>
                  <div className="flex justify-between font-semibold text-base pt-2 border-t border-border mt-2"><span>Ukupno</span><span>{formatPrice(selected.totalAmount)}</span></div>
                  <div className="flex justify-between text-muted-foreground pt-1"><span>Način plaćanja</span><span>{PAYMENT_METHOD_LABELS[selected.paymentMethod] ?? selected.paymentMethod}</span></div>
                </div>

                {selected.notes && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-1">Napomena</h3>
                    <p className="text-sm">{selected.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
