'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Star,
  Loader2,
  X,
} from 'lucide-react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import { SelectDropdown } from '../../../components/shared/select-dropdown';
import {
  getProducts,
  deleteProduct,
  type Product,
  type ProductsParams,
} from '../../../lib/api/client';
import { getAdminCategoryFlat, type AdminFlatCategory } from '../../../lib/api/categories';

function formatPrice(price: number): string {
  return new Intl.NumberFormat('sr-Latn-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 0,
  }).format(price);
}

export default function ProizvodiPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<AdminFlatCategory[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isFeatured, setIsFeatured] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: ProductsParams = { page, limit: 20 };
      if (search) params.search = search;
      if (categoryId) params.categoryId = categoryId;
      if (isFeatured === 'true') params.isFeatured = true;
      const res = await getProducts(params);
      setProducts(res.data);
      setMeta(res.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Greška pri učitavanju');
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId, isFeatured]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAdminCategoryFlat().then(setCategories).catch(() => {}); }, []);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteId);
      setDeleteId(null);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Greška pri brisanju');
    } finally {
      setDeleting(false);
    }
  }

  const categoryOptions = [
    { value: '', label: 'Sve kategorije' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Proizvodi
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {meta.total} proizvoda ukupno
            </p>
          </div>
          <a
            href="/dashboard/proizvodi/novi"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novi proizvod
          </a>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form
            className="relative flex-1"
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Pretraži po imenu, SKU..."
              className="w-full pl-9 pr-4 py-3 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </form>
          <SelectDropdown
            value={categoryId}
            onChange={(v) => { setCategoryId(v); setPage(1); }}
            options={categoryOptions}
            className="w-48"
          />
          <SelectDropdown
            value={isFeatured}
            onChange={(v) => { setIsFeatured(v); setPage(1); }}
            options={[{ value: '', label: 'Svi tipovi' }, { value: 'true', label: 'Istaknuti' }]}
            className="w-36"
          />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nema proizvoda koji odgovaraju filterima.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">PROIZVOD</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">KATEGORIJA</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">CENA</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">ZALIHE</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">STATUS</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">AKCIJE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-border flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-foreground flex items-center gap-1">
                              {p.name}
                              {p.isFeatured && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                            </div>
                            {p.sku && <div className="text-xs text-muted-foreground">SKU: {p.sku}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.category?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{formatPrice(p.price)}</div>
                        {p.salePrice && <div className="text-xs text-primary">{formatPrice(p.salePrice)}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={p.stock === 0 ? 'text-destructive font-medium' : ''}>
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          p.isActive
                            ? 'bg-green-100 text-green-700 ring-1 ring-green-200'
                            : 'bg-red-50 text-red-600 ring-1 ring-red-200'
                        }`}>
                          {p.isActive ? 'Aktivan' : 'Neaktivan'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`/dashboard/proizvodi/${p.id}`}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Izmeni"
                          >
                            <Pencil className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => setDeleteId(p.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Obriši"
                          >
                            <Trash2 className="w-4 h-4" />
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
              <span className="text-sm text-muted-foreground">
                Strana {meta.page} od {meta.totalPages} ({meta.total} ukupno)
              </span>
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

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2">Obriši proizvod</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Da li ste sigurni? Ova akcija se ne može poništiti.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
                Odustani
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-60 transition-colors flex items-center gap-2">
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Obriši
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
