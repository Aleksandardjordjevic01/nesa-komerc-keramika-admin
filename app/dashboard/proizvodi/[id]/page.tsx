'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Save, Trash2, Loader2, Plus, X, Upload,
  Star, Package, GripVertical, Check,
} from 'lucide-react';
import { DashboardLayout } from '../../../../components/layout/dashboard-layout';
import {
  getProduct, updateProduct, deleteProduct, getBrands, patchProductInStock,
  type Product, type Brand, type VariantItem,
} from '../../../../lib/api/client';
import { getAdminCategoryFlat, type AdminFlatCategory } from '../../../../lib/api/categories';
import { uploadProductImage, deleteUpload, uploadVariantIcon } from '../../../../lib/api/upload';
import { SelectDropdown } from '../../../../components/shared/select-dropdown';

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/50">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
      {children}
    </div>
  );
}

const INPUT = 'w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const INPUT_SM = 'w-full px-3 py-2 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

// ── Variant type ──────────────────────────────────────────────────────────────
// (VariantItem imported from lib/api/client)

// ── Image upload area ─────────────────────────────────────────────────────────

function ImageGrid({
  images,
  uploading,
  onUpload,
  onDelete,
  onReorder,
}: {
  images: string[];
  uploading: boolean;
  onUpload: (files: FileList) => void;
  onDelete: (url: string) => void;
  onReorder: (images: string[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dropZoneDrag, setDropZoneDrag] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  function handleZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropZoneDrag(false);
    if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files);
  }

  function handleDragStart(i: number) {
    dragIndex.current = i;
  }

  function handleDragOverItem(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIndex.current !== null && dragIndex.current !== i) setDragOver(i);
  }

  function handleDropOnItem(e: React.DragEvent, i: number) {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === i) { setDragOver(null); return; }
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    onReorder(next);
    dragIndex.current = null;
    setDragOver(null);
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDragOver(null);
  }

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDropZoneDrag(true); }}
        onDragLeave={() => setDropZoneDrag(false)}
        onDrop={handleZoneDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dropZoneDrag ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) { onUpload(e.target.files); e.target.value = ''; } }}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-primary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Uploading...</span>
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-sm text-muted-foreground">Prevuci slike ovde ili <span className="text-primary font-medium">klikni</span></p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP · Prevuci da promeniš redosled</p>
          </>
        )}
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {images.map((url, i) => (
            <div
              key={url}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOverItem(e, i)}
              onDrop={(e) => handleDropOnItem(e, i)}
              onDragEnd={handleDragEnd}
              className={`relative group aspect-square cursor-grab active:cursor-grabbing transition-all ${
                dragOver === i ? 'ring-2 ring-primary scale-95 opacity-60' : ''
              }`}
            >
              <img
                src={url}
                alt={`Slika ${i + 1}`}
                draggable={false}
                className="w-full h-full object-cover rounded-lg border border-border pointer-events-none"
              />
              {i === 0 && (
                <span className="absolute top-1 left-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                  Glavna
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(url); }}
                className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Variants editor ───────────────────────────────────────────────────────────

function VariantsEditor({
  variants,
  onChange,
}: {
  variants: VariantItem[];
  onChange: (v: VariantItem[]) => void;
}) {
  const [name, setName] = useState('');
  const [addType, setAddType] = useState<'color' | 'icon' | 'image' | null>(null);
  const [addColor, setAddColor] = useState('#ed2c18');
  const [addIconUrl, setAddIconUrl] = useState<string | null>(null);
  const [addImageUrl, setAddImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const iconRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  async function handleIconUpload(file: File) {
    setUploading(true);
    try { setAddIconUrl(await uploadVariantIcon(file)); }
    catch { /* ignore */ }
    finally { setUploading(false); }
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    try { setAddImageUrl(await uploadProductImage(file)); }
    catch { /* ignore */ }
    finally { setUploading(false); }
  }

  function add() {
    const val = name.trim();
    if (!val) return;
    if (!variants.find((v) => v.name.toLowerCase() === val.toLowerCase())) {
      const v: VariantItem = { name: val };
      if (addType === 'color') { v.type = 'color'; v.colorHex = addColor; }
      if (addType === 'icon' && addIconUrl) { v.type = 'icon'; v.iconUrl = addIconUrl; }
      if (addType === 'image' && addImageUrl) { v.type = 'image'; v.imageUrl = addImageUrl; }
      onChange([...variants, v]);
    }
    setName('');
    setAddType(null);
    setAddColor('#ed2c18');
    setAddIconUrl(null);
    setAddImageUrl(null);
  }

  return (
    <div className="space-y-3">
      {/* Existing variants */}
      {variants.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {variants.map((v, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-muted text-foreground px-2.5 py-1.5 rounded-full border border-border">
              {v.type === 'color' && v.colorHex && (
                <span className="w-3 h-3 rounded-full shrink-0 border border-black/10" style={{ background: v.colorHex }} />
              )}
              {v.type === 'icon' && v.iconUrl && (
                <img src={v.iconUrl} alt="" className="w-3.5 h-3.5 shrink-0 object-contain" />
              )}
              {v.type === 'image' && v.imageUrl && (
                <img src={v.imageUrl} alt="" className="w-4 h-4 rounded-full object-cover border border-border shrink-0" />
              )}
              {v.name}
              <button type="button" onClick={() => onChange(variants.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add type selector */}
      <div className="flex gap-1.5">
        {(['color', 'icon', 'image'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setAddType(addType === t ? null : t)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              addType === t ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
            }`}
          >
            {t === 'color' ? 'Boja' : t === 'icon' ? 'Ikonica' : 'Slika'}
          </button>
        ))}
      </div>

      {/* Type-specific input */}
      {addType === 'color' && (
        <div className="flex items-center gap-2.5">
          <input
            type="color"
            value={addColor}
            onChange={(e) => setAddColor(e.target.value)}
            className="h-9 w-9 rounded-lg cursor-pointer border border-border p-0.5 bg-card"
          />
          <span className="text-xs text-muted-foreground font-mono">{addColor}</span>
        </div>
      )}
      {addType === 'icon' && (
        <div>
          {addIconUrl ? (
            <div className="flex items-center gap-2">
              <img src={addIconUrl} alt="" className="w-8 h-8 object-contain border border-border rounded-lg p-1 bg-muted" />
              <button type="button" onClick={() => setAddIconUrl(null)} className="text-xs text-muted-foreground hover:text-destructive">Ukloni</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => iconRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading...' : 'Dodaj ikonu (SVG)'}
            </button>
          )}
          <input ref={iconRef} type="file" accept="image/svg+xml,image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { handleIconUpload(e.target.files[0]); e.target.value = ''; } }} />
        </div>
      )}
      {addType === 'image' && (
        <div>
          {addImageUrl ? (
            <div className="flex items-center gap-2">
              <img src={addImageUrl} alt="" className="w-10 h-10 object-cover rounded-lg border border-border" />
              <button type="button" onClick={() => setAddImageUrl(null)} className="text-xs text-muted-foreground hover:text-destructive">Ukloni</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imageRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading...' : 'Dodaj sliku'}
            </button>
          )}
          <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { handleImageUpload(e.target.files[0]); e.target.value = ''; } }} />
        </div>
      )}

      {/* Name input + add button */}
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Npr. Hrom, Mat crna... (Enter da dodaš)"
          className={INPUT_SM}
        />
        <button type="button" onClick={add} className="px-3 py-2 bg-primary text-white rounded-xl text-sm hover:bg-primary/90">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Specifications editor ─────────────────────────────────────────────────────

function SpecsEditor({
  specs,
  onChange,
}: {
  specs: { key: string; value: string }[];
  onChange: (s: { key: string; value: string }[]) => void;
}) {
  function update(i: number, field: 'key' | 'value', val: string) {
    const next = specs.map((s, j) => (j === i ? { ...s, [field]: val } : s));
    onChange(next);
  }

  function remove(i: number) { onChange(specs.filter((_, j) => j !== i)); }

  return (
    <div className="space-y-2">
      {specs.map((s, i) => (
        <div key={i} className="flex gap-2 items-center">
          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={s.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            placeholder="Naziv (npr. Visina)"
            className={INPUT_SM + ' flex-1'}
          />
          <input
            value={s.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            placeholder="Vrednost (npr. 285mm)"
            className={INPUT_SM + ' flex-1'}
          />
          <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...specs, { key: '', value: '' }])}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium"
      >
        <Plus className="w-3.5 h-3.5" /> Dodaj specifikaciju
      </button>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [categories, setCategories] = useState<AdminFlatCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Form state
  const [form, setForm] = useState({
    name: '',
    shortDescription: '',
    description: '',
    sku: '',
    price: '',
    salePrice: '',
    saleEndsAt: '',
    stock: '',

    categoryId: '',
    brandId: '',
    width: '',
    height: '',
    thickness: '',
    material: '',
    finish: '',
    usage: '',
    isActive: true,
    isFeatured: false,
  });
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [specs, setSpecs] = useState<{ key: string; value: string }[]>([]);
  const [inStock, setInStock] = useState(true);
  const [inStockSaving, setInStockSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, cats, brds] = await Promise.all([
        getProduct(id),
        getAdminCategoryFlat(),
        getBrands().catch(() => [] as Brand[]),
      ]);
      setProduct(p);
      setCategories(cats);
      setBrands(brds);
      setForm({
        name: p.name ?? '',
        shortDescription: p.shortDescription ?? '',
        description: p.description ?? '',
        sku: p.sku ?? '',
        price: String(p.price ?? ''),
        salePrice: p.salePrice != null ? String(p.salePrice) : '',
        saleEndsAt: p.saleEndsAt ? p.saleEndsAt.slice(0, 10) : '',
        stock: String(p.stock ?? 0),
        categoryId: p.categoryId ?? '',
        brandId: p.brandId ?? '',
        width: p.width != null ? String(p.width) : '',
        height: p.height != null ? String(p.height) : '',
        thickness: p.thickness != null ? String(p.thickness) : '',
        material: p.material ?? '',
        finish: p.finish ?? '',
        usage: p.usage ?? '',
        isActive: p.isActive,
        isFeatured: p.isFeatured,
      });
      setImages(p.images ?? []);
      setVariants(p.variants ?? []);
      setSpecs(p.specifications ?? []);
      setInStock(p.inStock ?? true);
    } catch {
      setError('Nije moguće učitati proizvod.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleUpload(files: FileList) {
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadProductImage(file);
        uploaded.push(url);
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Greška pri uploadu slike');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
    try { await deleteUpload(url); } catch { /* ignore */ }
  }

  async function handleSave() {
    setSaving(true); setSaveOk(false);
    try {
      const payload: Partial<Product> = {
        name: form.name,
        shortDescription: form.shortDescription || null,
        description: form.description || null,
        sku: form.sku || null,
        price: parseFloat(form.price) || 0,
        salePrice: form.salePrice ? parseFloat(form.salePrice) : null,
        saleEndsAt: form.saleEndsAt ? new Date(form.saleEndsAt).toISOString() : null,
        stock: parseInt(form.stock, 10) || 0,
        categoryId: form.categoryId,
        brandId: form.brandId || null,
        width: form.width ? parseFloat(form.width) : null,
        height: form.height ? parseFloat(form.height) : null,
        thickness: form.thickness ? parseFloat(form.thickness) : null,
        material: form.material || null,
        finish: form.finish || null,
        usage: form.usage || null,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        inStock: parseInt(form.stock, 10) > 0 ? true : inStock,
        images: images,
        variants: variants.length ? variants : null,
        specifications: specs.filter((s) => s.key && s.value).length
          ? specs.filter((s) => s.key && s.value)
          : null,
      };
      await updateProduct(id, payload);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Greška pri čuvanju');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleInStock(v: boolean) {
    setInStock(v);
    setInStockSaving(true);
    try {
      await patchProductInStock(id, v);
    } catch {
      setInStock(!v);
      alert('Greška pri promeni statusa lagera');
    } finally {
      setInStockSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteProduct(id);
      router.push('/dashboard/proizvodi');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Greška pri brisanju');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </DashboardLayout>
    );
  }

  if (error || !product) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-destructive">{error || 'Proizvod nije pronađen.'}</p>
          <button onClick={() => router.push('/dashboard/proizvodi')} className="mt-4 text-sm text-primary hover:underline">
            ← Nazad na listu
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/dashboard/proizvodi')}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground truncate">{form.name || 'Izmena proizvoda'}</h1>
              <p className="text-xs text-muted-foreground">Šifra: {form.sku || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {confirmDelete ? (
              <>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
                >
                  Odustani
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-destructive text-white rounded-xl hover:bg-destructive/90 disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Potvrdi brisanje
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
                title="Obriši proizvod"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveOk ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Čuvanje...' : saveOk ? 'Sačuvano!' : 'Sačuvaj'}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-8 gap-4">
          {/* ── Left column (main) ── */}
          <div className="lg:col-span-5 space-y-6">

            {/* Images */}
            <Section title="Slike proizvoda">
              <ImageGrid
                images={images}
                uploading={uploading}
                onUpload={handleUpload}
                onDelete={handleDeleteImage}
                onReorder={setImages}
              />
            </Section>

            {/* Basic info */}
            <Section title="Osnovne informacije">
              <Field label="Naziv proizvoda">
                <input value={form.name} onChange={(e) => setField('name', e.target.value)} className={INPUT} placeholder="Naziv proizvoda" />
              </Field>
              <Field label="Šifra proizvoda">
                <input value={form.sku} onChange={(e) => setField('sku', e.target.value)} className={INPUT} placeholder="C-01-101MB" />
              </Field>
              <Field label="Kratak opis">
                <textarea
                  value={form.shortDescription}
                  onChange={(e) => setField('shortDescription', e.target.value)}
                  rows={2}
                  className={INPUT}
                  placeholder="Kratak opis za listings stranicu..."
                />
              </Field>
              <Field label="Opis">
                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={5}
                  className={INPUT}
                  placeholder="Detaljan opis proizvoda..."
                />
              </Field>
            </Section>

            {/* Variants */}
            <Section title="Varijante">
              <p className="text-xs text-muted-foreground -mt-2">Dodajte varijante proizvoda (npr. boje, veličine)</p>
              <VariantsEditor variants={variants} onChange={setVariants} />
            </Section>

            {/* Specifications */}
            <Section title="Specifikacije">
              <p className="text-xs text-muted-foreground -mt-2">Tehničke specifikacije prikazane na stranici proizvoda</p>
              <SpecsEditor specs={specs} onChange={setSpecs} />
            </Section>

          </div>

          {/* ── Right column (sidebar) ── */}
          <div className="lg:col-span-3 space-y-6">

            {/* Pricing & stock */}
            <Section title="Cena i zalihe">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cena (RSD)">
                  <input type="number" value={form.price} onChange={(e) => setField('price', e.target.value)} className={INPUT_SM} placeholder="0" />
                </Field>
                <Field label="Zaliha (kom)">
                  <input type="number" value={form.stock} onChange={(e) => setField('stock', e.target.value)} className={INPUT_SM} placeholder="0" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Akcijska cena (RSD)">
                  <input type="number" value={form.salePrice} onChange={(e) => setField('salePrice', e.target.value)} className={INPUT_SM} placeholder="Prazno = nema akcije" />
                </Field>
                <Field label="Akcija važi do">
                  <input type="date" value={form.saleEndsAt} onChange={(e) => setField('saleEndsAt', e.target.value)} className={INPUT_SM} />
                </Field>
              </div>
            </Section>

            {/* Category & Brand */}
            <Section title="Kategorija i brend">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kategorija">
                  <SelectDropdown
                    value={form.categoryId}
                    onChange={(v) => setField('categoryId', v)}
                    options={[
                      { value: '', label: '— Kategorija —' },
                      ...categories.map((c) => ({
                        value: c.id,
                        label: '\u00a0'.repeat(c.level * 2) + c.name,
                      })),
                    ]}
                  />
                </Field>
                <Field label="Brend">
                  <SelectDropdown
                    value={form.brandId}
                    onChange={(v) => setField('brandId', v)}
                    options={[
                      { value: '', label: '— Brend —' },
                      ...brands.map((b) => ({ value: b.id, label: b.name })),
                    ]}
                  />
                </Field>
              </div>
            </Section>

            {/* Physical dimensions */}
            <Section title="Fizičke dimenzije">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Širina (cm)">
                  <input type="number" value={form.width} onChange={(e) => setField('width', e.target.value)} className={INPUT_SM} placeholder="—" />
                </Field>
                <Field label="Visina (cm)">
                  <input type="number" value={form.height} onChange={(e) => setField('height', e.target.value)} className={INPUT_SM} placeholder="—" />
                </Field>
                <Field label="Debljina (cm)">
                  <input type="number" value={form.thickness} onChange={(e) => setField('thickness', e.target.value)} className={INPUT_SM} placeholder="—" />
                </Field>
              </div>
              <Field label="Materijal">
                <input value={form.material} onChange={(e) => setField('material', e.target.value)} className={INPUT} placeholder="npr. Čelik, Keramika" />
              </Field>
              <Field label="Završna obrada">
                <input value={form.finish} onChange={(e) => setField('finish', e.target.value)} className={INPUT} placeholder="npr. Mat, Hrom, Sjajno" />
              </Field>
              <Field label="Upotreba">
                <input value={form.usage} onChange={(e) => setField('usage', e.target.value)} className={INPUT} placeholder="npr. Kupatilo, Kuhinja" />
              </Field>
            </Section>

            {/* Status */}
            <Section title="Status">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground font-medium">Aktivan</p>
                  <p className="text-xs text-muted-foreground">Vidljiv na sajtu</p>
                </div>
                <Toggle value={form.isActive} onChange={(v) => setField('isActive', v)} />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div>
                  <p className="text-sm text-foreground font-medium">Izdvojen</p>
                  <p className="text-xs text-muted-foreground">Prikazuje se na početnoj</p>
                </div>
                <Toggle value={form.isFeatured} onChange={(v) => setField('isFeatured', v)} />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div>
                  <p className="text-sm text-foreground font-medium">Na lageru</p>
                  <p className="text-xs text-muted-foreground">
                    {parseInt(form.stock, 10) > 0 ? 'Automatski — ima zalihe' : 'Dostupnost proizvoda'}
                  </p>
                </div>
                {parseInt(form.stock, 10) > 0 ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 ring-1 ring-blue-200">
                    Na lageru
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    {inStockSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                    <Toggle value={inStock} onChange={handleToggleInStock} />
                  </div>
                )}
              </div>
            </Section>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
