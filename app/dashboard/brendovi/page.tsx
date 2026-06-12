'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import {
  Plus, Pencil, Trash2, Loader2, X, Globe, Search, Upload, Check, Percent, Undo2,
} from 'lucide-react';
import {
  getBrands, createBrand, updateBrand, deleteBrand,
  applyBrandPriceAdjustment, undoBrandPriceAdjustment,
  type Brand,
} from '../../../lib/api/client';
import { uploadBrandLogo, deleteUpload } from '../../../lib/api/upload';

// ── helpers ───────────────────────────────────────────────────────────────────

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const INPUT = 'w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40';
const INPUT_SM = 'w-full px-3 py-2 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40';

const EMPTY = {
  name: '',
  slug: '',
  description: '',
  website: '',
  logoUrl: '',
  isActive: true,
};

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-foreground text-background text-sm px-5 py-3 rounded-xl shadow-xl whitespace-nowrap">
      {message}
    </div>
  );
}

// ── PriceAdjustmentModal ──────────────────────────────────────────────────────

function PriceAdjustmentModal({
  brand,
  onClose,
  onSuccess,
}: {
  brand: Brand;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [percent, setPercent] = useState('');
  const [applying, setApplying] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);

  const current = brand.priceAdjustmentPercent;
  const previous = brand.previousPriceAdjustmentPercent;
  const parsedPercent = parseFloat(percent);
  const validPercent = !isNaN(parsedPercent) && percent.trim() !== '';

  async function handleApply() {
    if (!validPercent) { setError('Unesite validan broj'); return; }
    if (!confirmStep) { setConfirmStep(true); return; }
    setApplying(true); setError('');
    try {
      const result = await applyBrandPriceAdjustment(brand.id, parsedPercent);
      const sign = parsedPercent > 0 ? '+' : '';
      onSuccess(`Uspešno ažurirano ${result.updatedCount} proizvoda za ${sign}${parsedPercent}%`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri primeni korekcije');
      setConfirmStep(false);
    } finally {
      setApplying(false);
    }
  }

  async function handleUndo() {
    setUndoing(true); setError('');
    try {
      const result = await undoBrandPriceAdjustment(brand.id);
      onSuccess(`Uspešno vraćeno ${result.updatedCount} proizvoda na prethodne cene`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri undo operaciji');
    } finally {
      setUndoing(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { if (confirmStep) setConfirmStep(false); else onClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirmStep]);

  const sign = parsedPercent > 0 ? '+' : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Korekcija cena</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{brand.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-5 py-4 space-y-4">
          {/* Current adjustment info */}
          <div className={`rounded-xl px-4 py-3 text-sm border ${current !== null && current !== undefined ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-muted border-border text-muted-foreground'}`}>
            {current !== null && current !== undefined
              ? <>Trenutno primenjena korekcija: <strong>{current > 0 ? '+' : ''}{current}%</strong></>
              : 'Nema aktivne korekcije'
            }
          </div>

          {/* Confirm step */}
          {confirmStep ? (
            <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 space-y-3">
              <p className="text-sm text-orange-800">
                Da li ste sigurni? Ovo će promeniti cene svih proizvoda brenda <strong>{brand.name}</strong> za <strong>{sign}{parsedPercent}%</strong>.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmStep(false)}
                  className="flex-1 text-sm py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Odustani
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="flex-1 flex items-center justify-center gap-2 text-sm py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors font-medium"
                >
                  {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {applying ? 'Primena...' : 'Da, primeni'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Percent input */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Procenat korekcije
                </p>
                <input
                  type="number"
                  value={percent}
                  onChange={(e) => { setPercent(e.target.value); setError(''); }}
                  className={INPUT}
                  placeholder="npr. 10 za +10%, -5 za -5%"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">Pozitivan broj povećava cenu, negativan smanjuje.</p>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleApply}
                  disabled={applying || !validPercent}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
                >
                  {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Percent className="w-4 h-4" />}
                  {applying ? 'Primena...' : 'Primeni korekciju'}
                </button>

                {previous !== null && previous !== undefined && (
                  <button
                    onClick={handleUndo}
                    disabled={undoing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm border border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-50 transition-colors"
                  >
                    {undoing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                    {undoing ? 'Vraćanje...' : 'Undo poslednje korekcije'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BrandModal ────────────────────────────────────────────────────────────────

function BrandModal({
  brand,
  onClose,
  onSaved,
}: {
  brand: Brand | null;
  onClose: () => void;
  onSaved: (b: Brand) => void;
}) {
  const isEdit = !!brand;
  const [form, setForm] = useState(
    brand
      ? {
          name: brand.name,
          slug: brand.slug ?? '',
          description: brand.description ?? '',
          website: brand.website ?? '',
          logoUrl: brand.logoUrl ?? '',
          isActive: brand.isActive,
        }
      : { ...EMPTY }
  );
  const [slugManual, setSlugManual] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function handleName(val: string) {
    setForm((p) => ({
      ...p,
      name: val,
      slug: slugManual ? p.slug : slugify(val),
    }));
  }

  async function handleLogoUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadBrandLogo(file);
      setField('logoUrl', url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri uploadu loga');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveLogo() {
    const old = form.logoUrl;
    setField('logoUrl', '');
    if (old) { try { await deleteUpload(old); } catch { /* ignore */ } }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Naziv je obavezan'); return; }
    setSaving(true); setError('');
    try {
      const payload: Partial<Brand> = {
        name: form.name.trim(),
        slug: form.slug || slugify(form.name),
        description: form.description || null,
        website: form.website || null,
        logoUrl: form.logoUrl || null,
        isActive: form.isActive,
      };
      const saved = isEdit
        ? await updateBrand(brand!.id, payload)
        : await createBrand(payload);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri čuvanju');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            {isEdit ? 'Izmeni brend' : 'Dodaj brend'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-4 sm:p-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-xl font-bold text-muted-foreground/40">{form.name.charAt(0).toUpperCase() || '?'}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-60"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? 'Uploading...' : 'Postavi logo'}
              </button>
              {form.logoUrl && (
                <button type="button" onClick={handleRemoveLogo} className="text-xs text-muted-foreground hover:text-destructive text-left">
                  Ukloni logo
                </button>
              )}
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) { handleLogoUpload(e.target.files[0]); e.target.value = ''; } }}
            />
          </div>

          {/* Name */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Naziv *</p>
            <input
              value={form.name}
              onChange={(e) => handleName(e.target.value)}
              className={INPUT}
              placeholder="npr. Geberit"
              autoFocus
            />
          </div>

          {/* Slug */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Slug (URL)</p>
            <input
              value={form.slug}
              onChange={(e) => { setSlugManual(true); setField('slug', e.target.value); }}
              className={INPUT}
              placeholder="geberit"
            />
          </div>

          {/* Website */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Website</p>
            <input
              value={form.website}
              onChange={(e) => setField('website', e.target.value)}
              className={INPUT}
              placeholder="https://www.geberit.com"
              type="url"
            />
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Opis</p>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={3}
              className={INPUT}
              placeholder="Kratki opis brenda..."
            />
          </div>

          {/* isActive */}
          <div className="flex items-center justify-between py-2 border-t border-border/50">
            <div>
              <p className="text-sm text-foreground font-medium">Aktivan</p>
              <p className="text-xs text-muted-foreground">Vidljiv na sajtu</p>
            </div>
            <button
              type="button"
              onClick={() => setField('isActive', !form.isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Footer */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
              Odustani
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Čuvanje...' : 'Sačuvaj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Brand card ────────────────────────────────────────────────────────────────

function BrandCard({
  brand,
  onEdit,
  onDelete,
  onToggle,
  onPriceAdjustment,
}: {
  brand: Brand;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onPriceAdjustment: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const adj = brand.priceAdjustmentPercent;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Logo area */}
      <div className="h-24 bg-muted/30 flex items-center justify-center border-b border-border/50 px-6">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.name} className="max-h-14 max-w-full object-contain" />
        ) : (
          <span className="text-3xl font-bold text-muted-foreground/20">{brand.name.charAt(0).toUpperCase()}</span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{brand.name}</p>
            {brand.website && (
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1 mt-0.5"
              >
                <Globe className="w-3 h-3 shrink-0" />
                {brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
          </div>
          <button
            onClick={onToggle}
            className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
              brand.isActive
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {brand.isActive ? 'Aktivan' : 'Neaktivan'}
          </button>
        </div>

        {brand.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{brand.description}</p>
        )}

        {/* Price adjustment badge */}
        {adj !== null && adj !== undefined && (
          <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 w-fit">
            <Percent className="w-3 h-3" />
            <span>Korekcija cena: {adj > 0 ? '+' : ''}{adj}%</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-2 border-t border-border/50">
          {confirmDelete ? (
            <>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 text-xs py-1.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Odustani
              </button>
              <button
                onClick={onDelete}
                className="flex-1 text-xs py-1.5 bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors"
              >
                Obriši
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onEdit}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                <Pencil className="w-3 h-3" /> Izmeni
              </button>
              <button
                onClick={onPriceAdjustment}
                title="Korekcija cena"
                className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-amber-700 hover:border-amber-300 transition-colors"
              >
                <Percent className="w-3 h-3" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrandPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; brand: Brand | null }>({ open: false, brand: null });
  const [priceModal, setPriceModal] = useState<Brand | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setBrands(await getBrands()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setModal({ open: true, brand: null }); }
  function openEdit(b: Brand) { setModal({ open: true, brand: b }); }
  function closeModal() { setModal({ open: false, brand: null }); }

  function handleSaved(saved: Brand) {
    setBrands((prev) => {
      const idx = prev.findIndex((b) => b.id === saved.id);
      return idx >= 0
        ? prev.map((b) => (b.id === saved.id ? saved : b))
        : [...prev, saved];
    });
    closeModal();
  }

  async function handleDelete(id: string) {
    try {
      await deleteBrand(id);
      setBrands((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Greška pri brisanju');
    }
  }

  async function handleToggle(brand: Brand) {
    try {
      const updated = await updateBrand(brand.id, { isActive: !brand.isActive });
      setBrands((prev) => prev.map((b) => (b.id === brand.id ? updated : b)));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Greška pri izmeni statusa');
    }
  }

  function handlePriceSuccess(msg: string) {
    setPriceModal(null);
    setToast(msg);
    load();
  }

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Brendovi</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? '...' : `${brands.length} brend${brands.length === 1 ? '' : 'a'}`}
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium sm:shrink-0"
          >
            <Plus className="w-4 h-4" />
            Dodaj brend
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pretraži brendove..."
            className={INPUT_SM + ' pl-9'}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">
              {search ? 'Nema brendova koji odgovaraju pretrazi.' : 'Još nema brendova. Dodaj prvi!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map((b) => (
              <BrandCard
                key={b.id}
                brand={b}
                onEdit={() => openEdit(b)}
                onDelete={() => handleDelete(b.id)}
                onToggle={() => handleToggle(b)}
                onPriceAdjustment={() => setPriceModal(b)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {modal.open && (
        <BrandModal
          brand={modal.brand}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {/* Price Adjustment Modal */}
      {priceModal && (
        <PriceAdjustmentModal
          brand={priceModal}
          onClose={() => setPriceModal(null)}
          onSuccess={handlePriceSuccess}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </DashboardLayout>
  );
}
