'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Check, ImagePlus, Trash2, GripVertical, Car, Home, Briefcase, Wrench, Tag } from 'lucide-react';
import { DashboardLayout } from '../../../../../components/layout/dashboard-layout';
import {
  getAdminListing,
  updateAdminListing,
  uploadAdminListingImage,
  deleteAdminListingImage,
  reorderAdminListingImages,
  type AdminListingDetail,
} from '../../../../../lib/api/client';
import RichTextEditor from '../../../../../components/shared/rich-text-editor';
import { SelectDropdown } from '../../../../../components/shared/select-dropdown';
import { Checkbox } from '../../../../../components/shared/checkbox';
import { ToggleOptionButton } from '../../../../../components/shared/toggle-option-button';
import { ListingEditHeader } from '../../../../../components/shared/listing-edit-header';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface Category {
  id: string;
  name: string;
  slug: string;
  children?: Category[];
}

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  icon: string | null;
  sortOrder: number | null;
}

interface CategorySuggestion {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  car: <Car className="w-5 h-5" />,
  home: <Home className="w-5 h-5" />,
  briefcase: <Briefcase className="w-5 h-5" />,
  wrench: <Wrench className="w-5 h-5" />,
};

async function fetchRootCategories(): Promise<CategoryItem[]> {
  try {
    const res = await fetch(`${API_URL}/categories/roots`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.data ?? []) as CategoryItem[];
  } catch { return []; }
}

async function fetchCategoryGroups(categoryId: string): Promise<CategoryItem[]> {
  try {
    const res = await fetch(`${API_URL}/categories/${categoryId}/groups`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.data ?? []) as CategoryItem[];
  } catch { return []; }
}

async function fetchFeaturedCategories(): Promise<CategoryItem[]> {
  try {
    const res = await fetch(`${API_URL}/categories/featured`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.data ?? []) as CategoryItem[];
  } catch { return []; }
}

async function fetchSuggestCategories(q: string): Promise<CategorySuggestion[]> {
  try {
    const res = await fetch(`${API_URL}/categories/suggest?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.data ?? []) as CategorySuggestion[];
  } catch { return []; }
}

async function fetchAllCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_URL}/categories/tree`);
    if (!res.ok) return [];
    const body = await res.json();
    const data = body?.data ?? body;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function flattenCategories(cats: Category[], prefix = ''): Array<{ id: string; name: string }> {
  const out: Array<{ id: string; name: string }> = [];
  for (const c of cats) {
    out.push({ id: c.id, name: prefix ? `${prefix} › ${c.name}` : c.name });
    if (c.children?.length) out.push(...flattenCategories(c.children, prefix ? `${prefix} › ${c.name}` : c.name));
  }
  return out;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const CONDITIONS = [
  { value: 'UNUSED', label: 'Nekorišćeno', subtitle: 'Polovno' },
  { value: 'USED', label: 'Korišćeno', subtitle: 'Polovno' },
  { value: 'DAMAGED', label: 'Oštećeno', subtitle: 'Neispravno' },
  { value: 'NEW', label: 'Novo', subtitle: 'Samo za firme' },
];

const PRICE_TYPES = [
  { value: 'STANDARD', label: '-' },
  { value: 'FREE', label: 'Besplatno' },
  { value: 'CONTACT', label: 'Kontakt' },
];

function RadioCard({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 cursor-pointer transition-all text-xs font-medium whitespace-nowrap ${
        selected
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border bg-card text-muted-foreground hover:bg-muted'
      }`}
    >
      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
        selected ? 'border-primary' : 'border-border'
      }`}>
        {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
      </div>
      {label}
    </button>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-card rounded-xl border border-border p-6 shadow-sm">{children}</div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-foreground mb-2">{children}</label>;
}

const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

export default function AdminListingEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [listing, setListing] = useState<AdminListingDetail | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Category section state
  const [rootCategories, setRootCategories] = useState<CategoryItem[]>([]);
  const [featuredCategories, setFeaturedCategories] = useState<CategoryItem[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryItem[]>([]);
  const [rootCategoryId, setRootCategoryId] = useState('');
  const [groupCategoryId, setGroupCategoryId] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const hasSearched = useRef(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [listingType, setListingType] = useState('sell');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priceAmount, setPriceAmount] = useState('');
  const [priceCurrency, setPriceCurrency] = useState('EUR');
  const [priceType, setPriceType] = useState('STANDARD');
  const [isPriceFixed, setIsPriceFixed] = useState(false);
  const [acceptsExchange, setAcceptsExchange] = useState(false);
  const [condition, setCondition] = useState('');
  const [isAvailableNow, setIsAvailableNow] = useState(false);
  const [allowsDelivery, setAllowsDelivery] = useState(false);
  const [allowsPickup, setAllowsPickup] = useState(false);
  const [contactCityOverride, setContactCityOverride] = useState('');
  const [showPhoneInListing, setShowPhoneInListing] = useState(false);

  // Image management
  const [images, setImages] = useState<Array<{ id: string; url: string; sortOrder: number }>>([]);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const dragIndexRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kategorijaRef = useRef<HTMLDivElement>(null);
  const identifikacijaRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<'kategorija' | 'unos' | 'identifikacija'>('unos');

  // Identifikacija
  const [sellerType, setSellerType] = useState<'individual' | 'business'>('individual');
  const [businessPib, setBusinessPib] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessConfirmed, setBusinessConfirmed] = useState(false);

  function handleScrollTo(section: 'kategorija' | 'identifikacija' | 'unos') {
    if (section === 'kategorija') {
      setActiveView('kategorija');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (section === 'identifikacija') {
      setActiveView('identifikacija');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveView('unos');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const [data, cats, roots, featured] = await Promise.all([
          getAdminListing(id),
          fetchAllCategories(),
          fetchRootCategories(),
          fetchFeaturedCategories(),
        ]);
        setListing(data);
        setCategories(flattenCategories(cats));
        setRootCategories(roots);
        setFeaturedCategories(featured);
        setTitle(data.title);
        setSuggestQuery(data.title);
        setListingType(data.listingType ?? 'sell');
        setDescription(data.description ?? '');
        setCategoryId(data.category.id);
        // If category has a parent, it's a group; otherwise it's a root
        if (data.category.parentId) {
          setRootCategoryId(data.category.parentId);
          setGroupCategoryId(data.category.id);
          const groups = await fetchCategoryGroups(data.category.parentId);
          setCategoryGroups(groups);
        } else {
          setRootCategoryId(data.category.id);
          setGroupCategoryId('');
          const groups = await fetchCategoryGroups(data.category.id);
          setCategoryGroups(groups);
        }
        setPriceAmount(data.priceAmount > 0 ? String(data.priceAmount) : '');
        setPriceCurrency(data.priceCurrency ?? 'EUR');
        setPriceType(data.priceType ?? 'STANDARD');
        setIsPriceFixed(data.isPriceFixed ?? false);
        setAcceptsExchange(data.acceptsExchange ?? false);
        setCondition(data.condition ?? '');
        setIsAvailableNow(data.isAvailableNow);
        setAllowsDelivery(data.allowsDelivery);
        setAllowsPickup(data.allowsPickup);
        setContactCityOverride(data.contactCityOverride ?? '');
        setShowPhoneInListing(data.showPhoneInListing);
        setSellerType((data.sellerType === 'business' ? 'business' : 'individual') as 'individual' | 'business');
        setBusinessPib(data.businessPib ?? '');
        setBusinessName(data.businessName ?? '');
        setBusinessAddress(data.businessAddress ?? '');
        setImages(data.images.map((img) => ({ id: img.id, url: img.fileKey, sortOrder: img.sortOrder })));
      } catch {
        setLoadError('Nije moguće učitati oglas.');
      }
    }
    load();
  }, [id]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImageError('');
    try {
      const result = await uploadAdminListingImage(id, file);
      setImages(result.allImages.map((img) => ({ id: img.id, url: img.url, sortOrder: img.sortOrder })));
    } catch (err: unknown) {
      setImageError(err instanceof Error ? err.message : 'Greška pri uploadu slike.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleImageDelete(imageId: string) {
    setImageError('');
    try {
      const result = await deleteAdminListingImage(id, imageId);
      setImages(result.remainingImages.map((img) => ({ id: img.id, url: img.url, sortOrder: img.sortOrder })));
    } catch (err: unknown) {
      setImageError(err instanceof Error ? err.message : 'Greška pri brisanju slike.');
    }
  }

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === index) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      dragIndexRef.current = index;
      return next.map((img, i) => ({ ...img, sortOrder: i }));
    });
  }

  async function handleDragEnd() {
    dragIndexRef.current = null;
    try {
      await reorderAdminListingImages(id, images.map((img) => img.id));
    } catch {
      // ignore reorder errors silently — local order is still updated
    }
  }

  async function handleRootCategoryChange(rootId: string) {
    setRootCategoryId(rootId);
    setGroupCategoryId('');
    setCategoryGroups([]);
    if (!rootId) return;
    setLoadingGroups(true);
    const groups = await fetchCategoryGroups(rootId);
    setCategoryGroups(groups);
    setLoadingGroups(false);
  }

  async function handleSuggest() {
    const q = suggestQuery.trim();
    if (q.length < 2) { setSuggestError('Unesite bar 2 karaktera.'); return; }
    setSuggestError('');
    setLoadingSuggestions(true);
    hasSearched.current = true;
    const results = await fetchSuggestCategories(q);
    setSuggestions(results);
    setLoadingSuggestions(false);
  }

  async function handleSuggestionClick(s: CategorySuggestion) {
    const rootId = s.parentId ?? s.id;
    setRootCategoryId(rootId);
    setGroupCategoryId(s.parentId ? s.id : '');
    setSuggestions([]);
    hasSearched.current = false;
    setLoadingGroups(true);
    const groups = await fetchCategoryGroups(rootId);
    setCategoryGroups(groups);
    setLoadingGroups(false);
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      await updateAdminListing(id, {
        title: title.trim(),
        description: description.trim(),
        categoryId: groupCategoryId || rootCategoryId || categoryId,
        priceAmount: priceAmount ? Number(priceAmount) : undefined,
        priceCurrency,
        priceType,
        isPriceFixed,
        acceptsExchange,
        listingType,
        condition: condition || undefined,
        isAvailableNow,
        allowsDelivery,
        allowsPickup,
        contactCityOverride: contactCityOverride.trim() || undefined,
        showPhoneInListing,
        sellerType,
        businessPib: sellerType === 'business' ? (businessPib.trim() || null) : null,
        businessName: sellerType === 'business' ? (businessName.trim() || null) : null,
        businessAddress: sellerType === 'business' ? (businessAddress.trim() || null) : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Nije moguće ažurirati oglas.');
    } finally {
      setSaving(false);
    }
  }

  if (!listing && !loadError) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center py-24 text-muted-foreground">Učitavanje...</div>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 text-center py-24">
          <p className="text-muted-foreground mb-4">{loadError}</p>
          <Link href="/dashboard/oglasi" className="text-primary hover:underline text-sm">← Nazad na oglase</Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        <form onSubmit={handleSave} className="space-y-6 max-w-[1024px]">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/oglasi/${id}`}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> {listing?.title}
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-foreground font-medium">Izmeni</span>
          </div>

          <h1 className="text-xl font-semibold text-foreground">Izmeni oglas</h1>

          <ListingEditHeader
            isSaving={saving}
            activeStep={activeView === 'kategorija' ? 1 : activeView === 'identifikacija' ? 3 : 2}
            onCancel={() => router.back()}
            onSave={handleSave}
            onScrollTo={handleScrollTo}
          />

          {activeView === 'unos' && (<>

          {/* Slike */}
          <SectionCard>
            {imageError && (
              <p className="text-xs text-destructive mb-3">{imageError}</p>
            )}
            <div className="flex gap-3 flex-wrap">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className="relative group w-36 h-36 rounded-xl overflow-hidden border border-border bg-muted cursor-grab active:cursor-grabbing flex-shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={`Slika ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {/* Drag handle - top left */}
                  <div className="absolute top-1.5 left-1.5 bg-black/50 rounded-lg p-1">
                    <GripVertical className="w-3.5 h-3.5 text-white" />
                  </div>
                  {/* Glavna badge - top right of first image */}
                  {index === 0 && (
                    <div className="absolute top-1.5 right-1.5 bg-primary text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      Glavna
                    </div>
                  )}
                  {/* Number badge - bottom left */}
                  <div className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                    #{index + 1}
                  </div>
                  {/* Delete button - bottom right, on hover */}
                  <button
                    type="button"
                    onClick={() => handleImageDelete(img.id)}
                    className="absolute bottom-1.5 right-1.5 bg-destructive rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Ukloni sliku"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              ))}
              {/* Upload slot */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-36 h-36 flex-shrink-0 rounded-xl border-2 border-dashed border-border bg-background hover:bg-muted transition-colors flex flex-col items-center justify-center gap-1.5 text-muted-foreground disabled:opacity-50"
              >
                <ImagePlus className="w-6 h-6" />
                <span className="text-xs font-medium">{uploading ? 'Otpremanje...' : 'Dodajte ili prevucite'}</span>
                {!uploading && (
                  <span className="text-[11px] text-muted-foreground/70">još {15 - images.length} slika</span>
                )}
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="text-amber-500 font-medium">💡 Savet:</span> Oglasi sa 4 ili više slika ostvaruju veći uspeh u prodaji i izabranoj grupi.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageUpload}
            />
          </SectionCard>
          </>)}

          {/* Kategorija view */}
          {activeView === 'kategorija' && (
          <div ref={kategorijaRef}>
          <SectionCard>
            {/* Featured quick-select */}
            {featuredCategories.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {featuredCategories.map((cat) => {
                  const isActive = rootCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => void handleRootCategoryChange(cat.id)}
                      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all text-left ${
                        isActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted/30 text-foreground hover:border-primary/50 hover:bg-muted/60'
                      }`}
                    >
                      <span className={`flex-shrink-0 p-1.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : 'bg-background text-muted-foreground'}`}>
                        {cat.icon && ICON_MAP[cat.icon] ? ICON_MAP[cat.icon] : <Tag className="w-5 h-5" />}
                      </span>
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {featuredCategories.length > 0 && <div className="border-t border-border mb-6" />}

            {/* Suggest */}
            <div className="space-y-3 mb-6">
              <p className="text-sm font-semibold text-foreground">Šta se oglašava?</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={suggestQuery}
                  onChange={(e) => { setSuggestQuery(e.target.value); hasSearched.current = false; setSuggestions([]); setSuggestError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSuggest(); } }}
                  placeholder="Naziv oglasa..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => void handleSuggest()}
                  disabled={loadingSuggestions}
                  className="flex-shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-colors"
                >
                  {loadingSuggestions ? 'Učitavam...' : 'Predloži gde'}
                </button>
              </div>
              {suggestError && <p className="text-xs text-destructive">{suggestError}</p>}
              {hasSearched.current && !loadingSuggestions && suggestions.length === 0 && (
                <p className="text-xs text-muted-foreground">Nema predloga za uneti pojam.</p>
              )}
              {suggestions.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => void handleSuggestionClick(s)} className="w-full text-left px-4 py-3 hover:bg-muted transition-colors">
                        <p className="text-sm font-semibold text-foreground">{s.name}</p>
                        {s.parentName && <p className="text-xs text-muted-foreground mt-0.5">{s.parentName}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-border mb-6" />

            {/* Manual selection */}
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground">Ili izaberite ručno</p>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">Kategorija *</label>
                <select
                  value={rootCategoryId}
                  onChange={(e) => void handleRootCategoryChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Izaberite kategoriju --</option>
                  {rootCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              {rootCategoryId && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">Grupa</label>
                  {loadingGroups ? (
                    <div className="h-9 w-full rounded-lg border border-border bg-muted/40 animate-pulse" />
                  ) : categoryGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nema podgrupa za ovu kategoriju.</p>
                  ) : (
                    <select
                      value={groupCategoryId}
                      onChange={(e) => setGroupCategoryId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">-- Izaberite grupu --</option>
                      {categoryGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </SectionCard>
          </div>
          )}

          {/* Identifikacija view */}
          {activeView === 'identifikacija' && (
          <SectionCard>
            <p className="text-sm font-semibold text-foreground mb-4">Oglase postavljam kao</p>

            {/* Radio options */}
            <div className="space-y-3 mb-4">
              {([
                { value: 'individual' as const, label: 'Fizičko lice', description: 'npr. prodaja korišćene lične stvari ili nekretnine' },
                { value: 'business' as const, label: 'Firma ili preduzetnik', description: 'Registrovano privredno društvo ili preduzetnik' },
              ]).map((opt) => {
                const selected = sellerType === opt.value;
                return (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setSellerType(opt.value)}
                  >
                    <div className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? 'border-primary' : 'border-border'}`}>
                      {selected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </div>
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {opt.label}
                      <span className="font-normal text-muted-foreground"> ({opt.description})</span>
                    </p>
                  </label>
                );
              })}
            </div>

            {/* Business fields */}
            {sellerType === 'business' && (
              <div className="space-y-4 pt-1">
                {/* Legal warning */}
                <div className="flex gap-3 rounded-xl border border-border bg-muted/40 p-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mt-0.5 h-5 w-5 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">Zabranjen unos lažnih podataka</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Krivični zakonik Republike Srbije - Član 301 (1) Ko unese netačan podatak, propusti unošenje tačnog podatka ili na drugi način prikrije ili lažno prikaže podatak i time utiče na rezultat elektronske obrade i prenosa podataka u nameri da sebi ili drugom pribavi protivpravnu imovinsku korist i time drugom prouzrokuje imovinsku štetu, kazniće se novčanom kaznom ili zatvorom do tri godine.
                    </p>
                  </div>
                </div>

                {/* PIB */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">PIB</label>
                  <input
                    type="text"
                    value={businessPib}
                    onChange={(e) => setBusinessPib(e.target.value)}
                    className="w-52 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Poslovno ime */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">Poslovno ime</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-52 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Adresa sedišta */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    Adresa sedišta{' '}
                    <span className="font-normal text-muted-foreground">(mesto, ulica, broj)</span>
                  </label>
                  <input
                    type="text"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    className="w-52 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Guarantee checkbox */}
                <label
                  className="flex items-center gap-2.5 cursor-pointer"
                  onClick={() => setBusinessConfirmed(!businessConfirmed)}
                >
                  <div className={`flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${businessConfirmed ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
                    {businessConfirmed && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-none stroke-white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1,4 3.5,6.5 9,1" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-foreground">Garantujem za tačnost unetih podataka</span>
                </label>
              </div>
            )}
          </SectionCard>
          )}

          {activeView === 'unos' && (<>

          {/* Naslov + Svrha */}
          <SectionCard>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <FieldLabel>Naslov oglasa *</FieldLabel>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputCls}
                  placeholder="Unesite naslov oglasa"
                />
              </div>
              <div className="shrink-0">
                <FieldLabel>Svrha oglasa *</FieldLabel>
                <div className="flex gap-2">
                  <RadioCard selected={listingType === 'sell'} onClick={() => setListingType('sell')} label="Prodajem" />
                  <RadioCard selected={listingType === 'buy'} onClick={() => setListingType('buy')} label="Kupujem" />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Cena */}
          <SectionCard>
            <div className="flex items-end gap-3 flex-wrap">
              {/* Cena + valuta */}
              <div>
                <FieldLabel>Cena *</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    disabled={priceType !== 'STANDARD'}
                    placeholder="0"
                    className="w-36 px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="flex gap-2">
                    <RadioCard selected={priceCurrency === 'RSD'} onClick={() => setPriceCurrency('RSD')} label="din" />
                    <RadioCard selected={priceCurrency === 'EUR'} onClick={() => setPriceCurrency('EUR')} label="eur" />
                  </div>
                </div>
              </div>

              <span className="text-sm text-muted-foreground pb-3">ili</span>

              {/* Način prodaje + opcije */}
              <div>
                <FieldLabel>Način prodaje</FieldLabel>
                <div className="flex items-center gap-4">
                  <SelectDropdown
                    options={PRICE_TYPES}
                    value={priceType}
                    onChange={setPriceType}
                    className="w-44"
                  />
                  <Checkbox checked={isPriceFixed} onChange={setIsPriceFixed} label="Fiksno" />
                  <Checkbox checked={acceptsExchange} onChange={setAcceptsExchange} label="Prihvatam zamenu" />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Opis */}
          <SectionCard>
            <FieldLabel>Opis *</FieldLabel>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Detaljan opis oglasa..."
              maxLength={5000}
            />
          </SectionCard>

          {/* Stanje */}
          <SectionCard>
            <FieldLabel>Stanje</FieldLabel>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {CONDITIONS.map((opt) => {
                const selected = condition === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCondition(selected ? '' : opt.value)}
                    className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                      selected ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selected ? 'border-primary' : 'border-border'
                      }`}>
                        {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground pl-6">{opt.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* Dostupnost */}
          <SectionCard>
            <label className="block text-xs font-medium text-foreground mb-4">Dostupnost (opciono)</label>
            <ToggleOptionButton checked={isAvailableNow} onChange={setIsAvailableNow} label="Dostupno odmah" />
          </SectionCard>

          {/* Način isporuke */}
          <SectionCard>
            <label className="block text-xs font-medium text-foreground mb-4">Način isporuke</label>
            <div className="flex flex-wrap gap-3">
              <ToggleOptionButton checked={allowsDelivery} onChange={setAllowsDelivery} label="Dostava" />
              <ToggleOptionButton checked={allowsPickup} onChange={setAllowsPickup} label="Lično preuzimanje" />
            </div>
          </SectionCard>

          {/* Kontakt */}
          <div ref={identifikacijaRef}>
          <SectionCard>
            <p className="text-sm font-semibold text-foreground mb-5">Lični podaci</p>

            {/* Seller name (read-only) */}
            <div className="space-y-0.5 mb-5">
              <p className="text-xs text-muted-foreground">Oglas postavlja</p>
              <p className="text-sm font-semibold text-foreground">{listing?.seller.displayName}</p>
              <p className="text-xs text-muted-foreground">
                Moguće promeniti u <span className="font-medium">Podešavanja naloga</span>
              </p>
            </div>

            {/* City override */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-foreground mb-1.5">Mesto/Grad</label>
              <input
                type="text"
                value={contactCityOverride}
                onChange={(e) => setContactCityOverride(e.target.value)}
                className={inputCls + ' max-w-[200px]'}
                placeholder={listing?.seller.city ?? 'Izaberite grad...'}
              />
            </div>

            {/* Phone toggle */}
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={showPhoneInListing}
                onChange={(e) => setShowPhoneInListing(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <span className="text-xs text-foreground">Prikažite broj telefona u oglasu</span>
            </label>

            {/* Phone warning + number */}
            {showPhoneInListing && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-red-500">
                  <span className="flex-shrink-0">⚠️</span>
                  <p className="text-xs leading-relaxed">
                    Budite oprezni! Ako Vas neko kontaktira putem Vibera, WhatsApp ili SMS-a ne otvarajte sumnjive linkove i ne delite kartične podatke.
                  </p>
                </div>
                {listing?.seller.phone ? (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Broj telefona</p>
                    <p className="text-sm font-semibold text-foreground">{listing.seller.phone}</p>
                    <p className="text-xs text-muted-foreground">
                      Moguće promeniti u <span className="font-medium">Podešavanja naloga</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600">
                    Korisnik nema sačuvan broj telefona.
                  </p>
                )}
              </div>
            )}
          </SectionCard>
          </div>
          </>)}

          {/* Feedback */}
          {saveError && (
            <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {saveError}
            </div>
          )}
          {saved && (
            <div className="px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm">
              Oglas je uspješno ažuriran.
            </div>
          )}

        </form>
      </div>
    </DashboardLayout>
  );
}

