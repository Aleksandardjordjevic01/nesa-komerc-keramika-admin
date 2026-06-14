'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Save, Loader2, Plus, Minus, X, Search, Check, Package, User,
} from 'lucide-react';
import { DashboardLayout } from '../../../../components/layout/dashboard-layout';
import {
  createAdminOrder, searchUsers, getProducts, searchCities, searchAddresses, getShippingMethods,
  type OrderStatus, type PaymentStatus, type PaymentMethod,
  type UserSearchResult, type Product, type CreateAdminOrderItem, type GeoCity, type GeoAddress, type ShippingMethod,
} from '../../../../lib/api/client';
import { SelectDropdown } from '../../../../components/shared/select-dropdown';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Na čekanju' },
  { value: 'confirmed', label: 'Potvrđena' },
  { value: 'processing', label: 'U obradi' },
  { value: 'shipped', label: 'Poslata' },
  { value: 'delivered', label: 'Isporučena' },
  { value: 'cancelled', label: 'Otkazana' },
];

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'unpaid', label: 'Nije plaćeno' },
  { value: 'paid', label: 'Plaćeno' },
  { value: 'refunded', label: 'Refundirano' },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash_on_delivery', label: 'Pouzećem' },
  { value: 'card', label: 'Kartica' },
  { value: 'invoice', label: 'Faktura' },
];

function formatPrice(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS', { style: 'currency', currency: 'RSD', maximumFractionDigits: 0 }).format(n);
}

// ── City autocomplete ─────────────────────────────────────────────────────────

function CityAutocomplete({
  value, onChange, onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (city: string, postcode: string) => void;
}) {
  const [results, setResults] = useState<GeoCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function calcStyle() {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const MAX_H = 280;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const goUp = spaceBelow < MAX_H && spaceAbove > spaceBelow;
    setDropStyle({
      position: 'fixed',
      top: goUp ? rect.top - Math.min(MAX_H, spaceAbove) - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: goUp ? Math.min(MAX_H, spaceAbove) : Math.min(MAX_H, spaceBelow),
      zIndex: 9999,
    });
  }

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value.trim()) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchCities(value.trim());
        setResults(res);
        calcStyle();
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (!inputRef.current) { setOpen(false); return; }
      const rect = inputRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) { setOpen(false); return; }
      calcStyle();
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (inputRef.current?.parentElement?.contains(t)) return;
      if (portalRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const INPUT_CLS = 'w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Beograd"
          className={INPUT_CLS}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={portalRef} style={dropStyle} className="bg-card border border-border rounded-xl shadow-xl overflow-y-auto">
          {results.length === 0
            ? <p className="px-4 py-3 text-sm text-muted-foreground">Nema rezultata.</p>
            : results.map((c) => (
              <button
                key={c.name + c.postcode}
                type="button"
                onClick={() => { onSelect(c.name, c.postcode); setOpen(false); setResults([]); }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0"
              >
                <span className="text-sm text-foreground">{c.name}</span>
                <span className="text-xs text-muted-foreground ml-3">{c.postcode}</span>
              </button>
            ))
          }
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── Address autocomplete ──────────────────────────────────────────────────────

function AddressAutocomplete({
  value, city, onChange, onSelect,
}: {
  value: string;
  city: string;
  onChange: (v: string) => void;
  onSelect: (address: string, postcode: string) => void;
}) {
  const [results, setResults] = useState<GeoAddress[]>([]);
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disabled = !city.trim();

  function calcStyle() {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const MAX_H = 280;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const goUp = spaceBelow < MAX_H && spaceAbove > spaceBelow;
    setDropStyle({
      position: 'fixed',
      top: goUp ? rect.top - Math.min(MAX_H, spaceAbove) - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: goUp ? Math.min(MAX_H, spaceAbove) : Math.min(MAX_H, spaceBelow),
      zIndex: 9999,
    });
  }

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (disabled || !value.trim() || value.length < 2) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await searchAddresses(value.trim(), city);
        if (res.length > 0) { setResults(res); calcStyle(); setOpen(true); }
        else { setResults([]); setOpen(false); }
      } catch { setOpen(false); }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, city, disabled]);

  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (!inputRef.current) { setOpen(false); return; }
      const rect = inputRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) { setOpen(false); return; }
      calcStyle();
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (inputRef.current?.parentElement?.contains(t)) return;
      if (portalRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const INPUT_CLS = 'w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <div>
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={disabled ? 'Prvo izaberite grad' : 'Knez Mihailova 1'}
        className={INPUT_CLS + (disabled ? ' opacity-60 cursor-not-allowed' : '')}
      />
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={portalRef} style={dropStyle} className="bg-card border border-border rounded-xl shadow-xl overflow-y-auto">
          {results.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onSelect(a.address, a.postcode); setOpen(false); setResults([]); }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0"
            >
              <span className="text-sm text-foreground">{a.address}</span>
              {a.postcode && <span className="text-xs text-muted-foreground ml-3">{a.postcode}</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function Section({ title, headerRight, children }: { title: string; headerRight?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between gap-3 rounded-t-xl">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {headerRight}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </p>
      {children}
    </div>
  );
}

const INPUT = 'w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40';
const INPUT_SM = 'w-full px-3 py-2 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

// ── Item row in cart ──────────────────────────────────────────────────────────

interface OrderLineItem extends CreateAdminOrderItem {
  productName: string;
  productSku: string | null;
  productImage: string | null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function NovaPorudzbinePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Kupac ──
  const [buyerMode, setBuyerMode] = useState<'user' | 'guest'>('guest');
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const userSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // ── Firma ──
  const [companyName, setCompanyName] = useState('');
  const [companyPib, setCompanyPib] = useState('');
  const [companyMb, setCompanyMb] = useState('');

  // ── Adresa ──
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingZipCode, setShippingZipCode] = useState('');
  const [shippingCountry, setShippingCountry] = useState('Srbija');

  // ── Stavke ──
  const [items, setItems] = useState<OrderLineItem[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // ── Ostalo ──
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState('');
  const [shippingCost, setShippingCost] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [notes, setNotes] = useState('');

  // ── User search ──
  useEffect(() => {
    getShippingMethods()
      .then((methods) => setShippingMethods(methods.filter((m) => m.isActive)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (userSearchRef.current) clearTimeout(userSearchRef.current);
    const q = userQuery.trim();
    if (q.length < 2) { setUserResults([]); return; }
    userSearchRef.current = setTimeout(async () => {
      setUserLoading(true);
      try { setUserResults(await searchUsers(q)); } catch { setUserResults([]); }
      finally { setUserLoading(false); }
    }, 300);
  }, [userQuery]);

  // ── Product search ──
  useEffect(() => {
    if (productSearchRef.current) clearTimeout(productSearchRef.current);
    const q = productQuery.trim();
    if (q.length < 2) { setProductResults([]); setShowProductDropdown(false); return; }
    productSearchRef.current = setTimeout(async () => {
      setProductLoading(true);
      try {
        const res = await getProducts({ search: q, limit: 8 });
        setProductResults(res.data);
        setShowProductDropdown(true);
      } catch { setProductResults([]); }
      finally { setProductLoading(false); }
    }, 300);
  }, [productQuery]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setShowProductDropdown(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserResults([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectUser(u: UserSearchResult) {
    setSelectedUser(u);
    setUserQuery('');
    setUserResults([]);
    if (u.phone && !guestPhone) setGuestPhone(u.phone);
  }

  function addProduct(p: Product) {
    setProductQuery('');
    setShowProductDropdown(false);
    setProductResults([]);
    const existing = items.findIndex((i) => i.productId === p.id);
    if (existing >= 0) {
      setItems((prev) => prev.map((item, idx) =>
        idx === existing ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setItems((prev) => [...prev, {
        productId: p.id,
        productName: p.name,
        productSku: p.sku,
        productImage: p.images?.[0] ?? null,
        quantity: 1,
        unitPrice: p.salePrice ?? p.price,
      }]);
    }
  }

  function updateItem(idx: number, field: 'quantity' | 'unitPrice', val: number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const shipping = parseFloat(shippingCost) || 0;
  const discount = parseFloat(discountAmount) || 0;
  const total = subtotal + shipping - discount;

  async function handleSave() {
    setSaveError('');
    if (buyerMode === 'guest' && !guestFirstName.trim()) { setSaveError('Ime kupca je obavezno.'); return; }
    if (buyerMode === 'user' && !selectedUser) { setSaveError('Izaberite korisnika.'); return; }
    if (!shippingAddress.trim() || !shippingCity.trim()) { setSaveError('Adresa i grad su obavezni.'); return; }
    if (items.length === 0) { setSaveError('Dodajte bar jednu stavku.'); return; }

    setSaving(true);
    try {
      const created = await createAdminOrder({
        ...(buyerMode === 'user' && selectedUser ? { userId: selectedUser.id } : {}),
        ...(buyerMode === 'guest' ? {
          guestName: `${guestFirstName.trim()} ${guestLastName.trim()}`.trim(),
          guestEmail: guestEmail.trim() || undefined,
          guestPhone: guestPhone.trim() || undefined,
        } : {}),
        shippingAddress: shippingAddress.trim(),
        shippingCity: shippingCity.trim(),
        shippingZipCode: shippingZipCode.trim(),
        shippingCountry: shippingCountry.trim() || 'Srbija',
        paymentMethod,
        paymentStatus,
        status,
        shippingCost: shipping,
        discountAmount: discount,
        notes: notes.trim() || undefined,
        companyName: companyName.trim() || undefined,
        pib: companyPib.trim() || undefined,
        mb: companyMb.trim() || undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
      });
      setSaveOk(true);
      setTimeout(() => router.push(`/dashboard/narudzbine/${created.id}`), 800);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Greška pri kreiranju narudžbine.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/dashboard/narudzbine')}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Nova narudžbina</h1>
              <p className="text-xs text-muted-foreground">Ručno kreiranje narudžbine</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => router.push('/dashboard/narudzbine')}
              className="hidden sm:block px-3 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
            >
              Odustani
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saveOk}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveOk ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span className="hidden sm:inline">{saving ? 'Kreiranje...' : saveOk ? 'Kreirano!' : 'Kreiraj narudžbinu'}</span>
              <span className="sm:hidden">{saving ? '...' : saveOk ? 'OK' : 'Kreiraj'}</span>
            </button>
          </div>
        </div>

        {saveError && (
          <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {saveError}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* ── Kupac ── */}
            <Section
              title="Kupac"
              headerRight={
                <div className="flex gap-1.5">
                  {(['guest', 'user'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => { setBuyerMode(mode); setSelectedUser(null); setUserQuery(''); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        buyerMode === mode
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {mode === 'guest' ? <User className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                      {mode === 'guest' ? 'Gost' : 'Postojeći korisnik'}
                    </button>
                  ))}
                </div>
              }
            >
              {buyerMode === 'user' ? (
                <div className="space-y-3">
                  {selectedUser ? (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-primary/30 bg-primary/5">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {selectedUser.firstName} {selectedUser.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                        {selectedUser.phone && <p className="text-xs text-muted-foreground">{selectedUser.phone}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedUser(null)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div ref={userDropdownRef} className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        {userLoading
                          ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                          : null
                        }
                        <input
                          value={userQuery}
                          onChange={(e) => setUserQuery(e.target.value)}
                          placeholder="Pretraži po imenu ili emailu..."
                          className="w-full pl-9 pr-9 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                      {userResults.length > 0 && (
                        <ul className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                          {userResults.map((u) => (
                            <li key={u.id}>
                              <button
                                type="button"
                                onClick={() => selectUser(u)}
                                className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors"
                              >
                                <p className="text-sm font-medium text-foreground">{u.firstName} {u.lastName}</p>
                                <p className="text-xs text-muted-foreground">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {userQuery.trim().length >= 2 && !userLoading && userResults.length === 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">Nema rezultata.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid sm:grid-cols-4 gap-3">
                  <Field label="Ime" required>
                    <input value={guestFirstName} onChange={(e) => setGuestFirstName(e.target.value)} className={INPUT} placeholder="Marko" />
                  </Field>
                  <Field label="Prezime">
                    <input value={guestLastName} onChange={(e) => setGuestLastName(e.target.value)} className={INPUT} placeholder="Marković" />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className={INPUT} placeholder="marko@gmail.com" />
                  </Field>
                  <Field label="Telefon">
                    <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className={INPUT} placeholder="0641234567" />
                  </Field>
                </div>
              )}
            </Section>

            {/* ── Firma ── */}
            <Section title="Podaci o firmi (opciono)">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Ime firme">
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={INPUT} placeholder="d.o.o. Primer" />
                </Field>
                <Field label="PIB">
                  <input value={companyPib} onChange={(e) => setCompanyPib(e.target.value)} className={INPUT} placeholder="123456789" />
                </Field>
                <Field label="MB">
                  <input value={companyMb} onChange={(e) => setCompanyMb(e.target.value)} className={INPUT} placeholder="12345678" />
                </Field>
              </div>
            </Section>

            {/* ── Adresa dostave ── */}
            <Section title="Adresa dostave">
              <div className="grid grid-cols-[3fr_2fr] gap-3">
                <Field label="Grad" required>
                  <CityAutocomplete
                    value={shippingCity}
                    onChange={(v) => { setShippingCity(v); setShippingZipCode(''); setShippingAddress(''); }}
                    onSelect={(city, postcode) => { setShippingCity(city); setShippingZipCode(postcode); setShippingAddress(''); }}
                  />
                </Field>
                <Field label="Poštanski broj">
                  <input value={shippingZipCode} onChange={(e) => setShippingZipCode(e.target.value)} className={INPUT} placeholder="11000" />
                </Field>
              </div>
              <Field label="Ulica i broj" required>
                <AddressAutocomplete
                  value={shippingAddress}
                  city={shippingCity}
                  onChange={setShippingAddress}
                  onSelect={(address, postcode) => {
                    setShippingAddress(address);
                    if (postcode) setShippingZipCode(postcode);
                  }}
                />
              </Field>
              <Field label="Zemlja">
                <p className="text-sm text-foreground py-1">Srbija</p>
              </Field>
            </Section>

            {/* ── Stavke ── */}
            <Section title="Stavke narudžbine">
              {/* Product search */}
              <div ref={productDropdownRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  {productLoading
                    ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    : null
                  }
                  <input
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Pretraži i dodaj proizvod..."
                    className="w-full pl-9 pr-9 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                {showProductDropdown && productResults.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                    {productResults.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => addProduct(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors flex items-center gap-3"
                        >
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover border border-border shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.sku ? `${p.sku} · ` : ''}{formatPrice(p.salePrice ?? p.price)}
                            </p>
                          </div>
                          <Plus className="w-4 h-4 text-primary shrink-0 ml-auto" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Items table */}
              {items.length > 0 ? (
                <div className="space-y-2 mt-1">
                  {/* Desktop header */}
                  <div className="hidden sm:grid sm:grid-cols-[1fr_132px_120px_32px] gap-2 px-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Proizvod</p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">Kol.</p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Cena (RSD)</p>
                    <span />
                  </div>
                  {items.map((item, idx) => (
                    <div key={item.productId}>
                      {/* Desktop row */}
                      <div className="hidden sm:grid sm:grid-cols-[1fr_132px_120px_32px] gap-2 items-center bg-muted/30 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.productImage ? (
                            <img src={item.productImage} alt="" className="w-8 h-8 rounded-lg object-cover border border-border shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                              <Package className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
                            {item.productSku && <p className="text-xs text-muted-foreground">{item.productSku}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => updateItem(idx, 'quantity', Math.max(1, item.quantity - 1))} className="p-1 rounded-lg border border-border hover:bg-muted transition-colors shrink-0">
                            <Minus className="w-3 h-3" />
                          </button>
                          <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))} className="w-full px-1 py-1.5 text-sm text-center border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                          <button type="button" onClick={() => updateItem(idx, 'quantity', item.quantity + 1)} className="p-1 rounded-lg border border-border hover:bg-muted transition-colors shrink-0">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <input type="number" min={0} value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-sm text-right border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                        <button type="button" onClick={() => removeItem(idx)} className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Mobile card */}
                      <div className="sm:hidden bg-muted/30 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.productImage ? (
                              <img src={item.productImage} alt="" className="w-8 h-8 rounded-lg object-cover border border-border shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{item.productName}</p>
                              {item.productSku && <p className="text-xs text-muted-foreground">{item.productSku}</p>}
                            </div>
                          </div>
                          <button type="button" onClick={() => removeItem(idx)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => updateItem(idx, 'quantity', Math.max(1, item.quantity - 1))} className="p-1 rounded-lg border border-border hover:bg-muted transition-colors">
                              <Minus className="w-3 h-3" />
                            </button>
                            <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))} className="w-14 px-1 py-1.5 text-sm text-center border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                            <button type="button" onClick={() => updateItem(idx, 'quantity', item.quantity + 1)} className="p-1 rounded-lg border border-border hover:bg-muted transition-colors">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input type="number" min={0} value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-28 px-2 py-1.5 text-sm text-right border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                            <span className="text-xs text-muted-foreground">RSD</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2 border-2 border-dashed border-border rounded-xl">
                  <Package className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Pretražite i dodajte proizvode</p>
                </div>
              )}
            </Section>

            {/* ── Napomena ── */}
            <Section title="Napomena">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Interna napomena (opciono)..."
                className={INPUT}
              />
            </Section>

          </div>

          {/* ── Right column ── */}
          <div className="lg:col-span-1 space-y-4">

            {/* ── Statusi ── */}
            <Section title="Status">
              <Field label="Status narudžbine">
                <SelectDropdown
                  value={status}
                  onChange={(v) => setStatus(v as OrderStatus)}
                  options={ORDER_STATUS_OPTIONS}
                />
              </Field>
              <Field label="Status uplate">
                <SelectDropdown
                  value={paymentStatus}
                  onChange={(v) => setPaymentStatus(v as PaymentStatus)}
                  options={PAYMENT_STATUS_OPTIONS}
                />
              </Field>
              <Field label="Način plaćanja">
                <SelectDropdown
                  value={paymentMethod}
                  onChange={(v) => setPaymentMethod(v as PaymentMethod)}
                  options={PAYMENT_METHOD_OPTIONS}
                />
              </Field>
            </Section>

            {/* ── Troškovi ── */}
            <Section title="Troškovi i popust">
              {shippingMethods.length > 0 && (
                <Field label="Način dostave">
                  <SelectDropdown
                    value={selectedShippingMethodId}
                    onChange={(v) => {
                      setSelectedShippingMethodId(v);
                      const method = shippingMethods.find((m) => m.id === v);
                      if (method) setShippingCost(String(method.price));
                    }}
                    options={[
                      { value: '', label: '— Izaberite način dostave —' },
                      ...shippingMethods.map((m) => ({
                        value: m.id,
                        label: `${m.name} — ${new Intl.NumberFormat('sr-Latn-RS', { style: 'currency', currency: 'RSD', maximumFractionDigits: 0 }).format(m.price)}${m.freeAbove ? ` (besplatno iznad ${new Intl.NumberFormat('sr-Latn-RS', { style: 'currency', currency: 'RSD', maximumFractionDigits: 0 }).format(m.freeAbove)})` : ''}`,
                      })),
                    ]}
                  />
                </Field>
              )}
              <Field label="Dostava (RSD)">
                <input
                  type="number"
                  min={0}
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  className={INPUT_SM}
                  placeholder="0"
                />
              </Field>
              <Field label="Popust (RSD)">
                <input
                  type="number"
                  min={0}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className={INPUT_SM}
                  placeholder="0"
                />
              </Field>
            </Section>

            {/* ── Rekapitulacija ── */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-2.5">
              <p className="text-sm font-semibold text-foreground mb-3">Rekapitulacija</p>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Međuzbir ({items.length} stavki)</span>
                <span className="font-medium text-foreground">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Dostava</span>
                <span className="font-medium text-foreground">{formatPrice(shipping)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Popust</span>
                  <span className="font-medium">−{formatPrice(discount)}</span>
                </div>
              )}
              <div className="pt-2.5 border-t border-border flex justify-between">
                <span className="text-sm font-semibold text-foreground">Ukupno</span>
                <span className="text-base font-bold text-primary">{formatPrice(total)}</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
