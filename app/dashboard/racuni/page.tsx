'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Search, X, Printer, Pencil, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import { SelectDropdown } from '../../../components/shared/select-dropdown';
import {
  getInvoices, deleteInvoice,
  type Invoice, type InvoiceType, type InvoiceStatus, type InvoiceParams,
} from '../../../lib/api/client';

const TYPE_LABELS: Record<InvoiceType, string> = {
  racun: 'Račun',
  predracun: 'Predračun',
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Nacrt',
  issued: 'Izdat',
  paid: 'Plaćen',
  cancelled: 'Otkazan',
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200',
  issued: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  paid: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  cancelled: 'bg-red-50 text-red-600 ring-1 ring-red-200',
};

function formatPrice(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS', { style: 'currency', currency: 'RSD', maximumFractionDigits: 2 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('sr-Latn-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function RacuniPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: InvoiceParams = { page, limit: 20 };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter as InvoiceType;
      if (statusFilter) params.status = statusFilter as InvoiceStatus;
      const res = await getInvoices(params);
      setInvoices(res.data);
      setMeta({ page: res.meta.page, limit: res.meta.limit, total: res.meta.total, totalPages: res.meta.totalPages ?? Math.ceil(res.meta.total / res.meta.limit) });
    } catch (e: any) {
      setError(e.message ?? 'Greška');
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, num: string) {
    if (!confirm(`Obrisati ${num}?`)) return;
    setDeleting(id);
    try { await deleteInvoice(id); await load(); }
    catch (e: any) { alert(e.message); }
    finally { setDeleting(null); }
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Računi i predračuni
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{meta.total} dokumenata ukupno</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/racuni/novi')}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novi dokument
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Pretraži po broju, klijentu, PIB..."
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <SelectDropdown
              value={typeFilter}
              onChange={(v) => { setTypeFilter(v); setPage(1); }}
              options={[{ value: '', label: 'Svi tipovi' }, { value: 'racun', label: 'Račun' }, { value: 'predracun', label: 'Predračun' }]}
              className="flex-1 sm:w-40"
            />
            <SelectDropdown
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={[{ value: '', label: 'Svi statusi' }, ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
              className="flex-1 sm:w-40"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-destructive">{error}</div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nema dokumenata</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Broj</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tip</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Klijent</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Datum</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Iznos</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.type === 'racun' ? 'bg-primary/10 text-primary' : 'bg-violet-50 text-violet-700 ring-1 ring-violet-200'}`}>
                          {TYPE_LABELS[inv.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground truncate max-w-[180px]">{inv.clientName}</p>
                        {inv.clientPib && <p className="text-xs text-muted-foreground">PIB: {inv.clientPib}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inv.status]}`}>
                          {STATUS_LABELS[inv.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                        {formatPrice(Number(inv.totalAmount))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => window.open(`/dashboard/racuni/${inv.id}/print`, '_blank')}
                            title="Štampaj / PDF"
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/racuni/${inv.id}`)}
                            title="Uredi"
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                            disabled={deleting === inv.id}
                            title="Obriši"
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {deleting === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Strana {meta.page} od {meta.totalPages} ({meta.total} ukupno)
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
