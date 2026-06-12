'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Save, Trash2, Loader2, Check, Plus, Minus, X,
  Pencil, ShoppingCart, Search, FileDown,
} from 'lucide-react';
import { DashboardLayout } from '../../../../components/layout/dashboard-layout';
import {
  getOrder,
  updateOrder,
  updateOrderStatus,
  updateOrderPaymentStatus,
  deleteOrder,
  downloadOrderPdf,
  getProducts,
  searchCities,
  searchAddresses,
  type Order,
  type OrderStatus,
  type PaymentStatus,
  type UpdateOrderPayload,
  type UpdateOrderItemPayload,
  type Product,
  type GeoCity,
  type GeoAddress,
} from '../../../../lib/api/client';

// ── Style constants ───────────────────────────────────────────────────────────

const INPUT = 'w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40';
const SELECT = 'w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40';
const NO_SPIN = ' [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

// ── Sub-components ────────────────────────────────────────────────────────────

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

function ViewValue({ value }: { value?: string | number | null }) {
  return (
    <p className="text-sm text-foreground py-1">
      {value !== undefined && value !== null && value !== ''
        ? String(value)
        : <span className="text-muted-foreground">—</span>}
    </p>
  );
}

function emailStatusMessage(email?: { sent: boolean; message?: string }) {
  if (!email) return null;
  if (email.sent) return 'Status promenjen i email poslat kupcu.';
  return `Status je promenjen, ali email nije poslat${email.message ? `: ${email.message}` : '.'}`;
}

// ── Product search — portal-based dropdown ────────────────────────────────────

function ProductSearch({ onAdd }: { onAdd: (p: Product) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function calcStyle() {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const MAX_H = 320;
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
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getProducts({ search: query.trim(), limit: 10 });
        setResults(res.data);
        calcStyle();
        setOpen(true);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Reposition on scroll/resize
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

  // Close on outside click
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

  function select(p: Product) {
    onAdd(p);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pretraži po imenu ili šifri..."
          className={INPUT + ' pl-9 pr-9'}
          autoFocus
        />
        {loading
          ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          : query
            ? <button onClick={() => { setQuery(''); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            : null
        }
      </div>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={portalRef}
          style={dropStyle}
          className="bg-card border border-border rounded-xl shadow-xl overflow-y-auto"
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Nema rezultata.</p>
          ) : results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => select(p)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0"
            >
              <div className="min-w-0 mr-4">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                {p.sku && <p className="text-xs text-muted-foreground mt-0.5">{p.sku}</p>}
              </div>
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                {new Intl.NumberFormat('sr-Latn-RS', { style: 'currency', currency: 'RSD', maximumFractionDigits: 0 }).format(p.price)}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── City autocomplete ─────────────────────────────────────────────────────────

function CityAutocomplete({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (city: string, postcode: string) => void;
}) {
  const [results, setResults] = useState<GeoCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
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

  async function loadResults(query: string) {
    const trimmed = query.trim();
    setLoading(true);
    setMessage('');
    calcStyle();
    setOpen(true);
    try {
      const res = await searchCities(trimmed);
      setResults(res);
      setMessage(res.length === 0 ? 'Nema rezultata.' : '');
      calcStyle();
      setOpen(true);
    } catch {
      setResults([]);
      setMessage('Greška pri pretrazi gradova.');
      calcStyle();
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value.trim()) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      await loadResults(value);
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

  return (
    <div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { void loadResults(value); }}
        placeholder="Beograd"
        className={INPUT}
      />
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={portalRef} style={dropStyle} className="bg-card border border-border rounded-xl shadow-xl overflow-y-auto">
          {loading && <p className="px-4 py-3 text-sm text-muted-foreground">Učitavanje...</p>}
          {!loading && message && <p className="px-4 py-3 text-sm text-muted-foreground">{message}</p>}
          {!loading && results.map((c) => (
            <button
              key={c.name + c.postcode}
              type="button"
              onClick={() => { onSelect(c.name, c.postcode); setOpen(false); setResults([]); }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0"
            >
              <span className="text-sm text-foreground">{c.name}</span>
              <span className="text-xs text-muted-foreground ml-3">{c.postcode}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── Address autocomplete ──────────────────────────────────────────────────────

function AddressAutocomplete({
  value,
  city,
  disabled,
  onChange,
  onSelect,
}: {
  value: string;
  city: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  onSelect: (address: string, postcode: string) => void;
}) {
  const [results, setResults] = useState<GeoAddress[]>([]);
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
    if (disabled || !city.trim() || !value.trim() || value.length < 2) { setResults([]); setOpen(false); return; }
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

  return (
    <div>
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={disabled ? 'Prvo izaberite grad' : 'Ulica bb'}
        className={INPUT + (disabled ? ' opacity-60 cursor-not-allowed' : '')}
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

// ── Constants ─────────────────────────────────────────────────────────────────

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
  pending: 'bg-amber-400', confirmed: 'bg-blue-500', processing: 'bg-purple-500',
  shipped: 'bg-cyan-500', delivered: 'bg-green-500', cancelled: 'bg-red-500',
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

// ── Editable item type ────────────────────────────────────────────────────────

interface EditableItem {
  productId: string;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitPrice: number;
  isNew: boolean;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(searchParams.get('edit') === 'true');
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saveWarning, setSaveWarning] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [form, setForm] = useState<UpdateOrderPayload>({});
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [selectedShippingCity, setSelectedShippingCity] = useState('');
  const [selectedShippingAddress, setSelectedShippingAddress] = useState('');
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const o = await getOrder(id);
      setOrder(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri učitavanju');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function enterEdit(o: Order) {
    setForm({
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      shippingAddress: o.shippingAddress ?? '',
      shippingCity: o.shippingCity ?? '',
      shippingZipCode: o.shippingZipCode ?? '',
      shippingCountry: 'Srbija',
      shippingCost: o.shippingCost,
      guestName: `${o.user?.firstName ?? ''} ${o.user?.lastName ?? ''}`.trim(),
      guestEmail: o.user?.email ?? '',
      guestPhone: o.user?.phone ?? '',
      companyName: o.companyName ?? '',
      pib: o.pib ?? '',
      mb: o.mb ?? '',
      notes: o.notes ?? '',
      couponCode: o.couponCode ?? '',
      discountAmount: o.discountAmount,
    });
    setGuestFirstName(o.user?.firstName ?? '');
    setGuestLastName(o.user?.lastName ?? '');
    setSelectedShippingCity(o.shippingCity ?? '');
    setSelectedShippingAddress(o.shippingAddress ?? '');
    setEditItems(
      o.items.map((it) => ({
        productId: it.productId,
        productName: it.product?.name ?? it.productName,
        productSku: it.product?.sku ?? null,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        isNew: false,
      })),
    );
    setShowSearch(false);
    setEditMode(true);
    setSaveErr('');
    setSaveMessage('');
    setSaveWarning('');
  }

  function cancelEdit() {
    setEditMode(false);
    setShowSearch(false);
    setSaveErr('');
    setSaveMessage('');
    setSaveWarning('');
    setSelectedShippingCity('');
    setSelectedShippingAddress('');
    setGuestFirstName('');
    setGuestLastName('');
  }

  function setF<K extends keyof UpdateOrderPayload>(k: K, v: UpdateOrderPayload[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function updateItem(idx: number, patch: Partial<EditableItem>) {
    setEditItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function removeItem(idx: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addProduct(p: Product) {
    // Prevent duplicates — if product already in list, just increment quantity
    const existing = editItems.findIndex((it) => it.productId === p.id);
    if (existing !== -1) {
      updateItem(existing, { quantity: editItems[existing].quantity + 1 });
      setShowSearch(false);
      return;
    }
    setEditItems((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        productSku: p.sku,
        quantity: 1,
        unitPrice: p.price,
        isNew: true,
      },
    ]);
    setShowSearch(false);
  }

  async function handleSave() {
    setSaving(true); setSaveErr(''); setSaveOk(false); setSaveMessage(''); setSaveWarning('');
    try {
      const shippingCity = (form.shippingCity ?? '').trim();
      const shippingAddress = (form.shippingAddress ?? '').trim();

      if (!shippingCity || shippingCity !== selectedShippingCity) {
        throw new Error('Izaberite grad iz padajuće liste.');
      }

      if (!shippingAddress || shippingAddress !== selectedShippingAddress) {
        throw new Error('Izaberite ulicu iz padajuće liste.');
      }

      const payload: UpdateOrderPayload = {
        ...form,
        guestName: [guestFirstName, guestLastName].map((part) => part.trim()).filter(Boolean).join(' '),
        shippingCity,
        shippingAddress,
        shippingCountry: 'Srbija',
      };
      const nextStatus = payload.status;
      const nextPaymentStatus = payload.paymentStatus;
      delete payload.status;
      delete payload.paymentStatus;

      const itemsChanged =
        editItems.length !== order!.items.length ||
        editItems.some((it, i) => {
          const orig = order!.items[i];
          return !orig || it.productId !== orig.productId || it.quantity !== orig.quantity || it.unitPrice !== orig.unitPrice;
        });

      if (itemsChanged) {
        payload.items = editItems.map((it): UpdateOrderItemPayload => {
          if (it.isNew) {
            // New item: no unitPrice — backend uses current product price
            return { productId: it.productId, quantity: it.quantity };
          }
          // Existing item: send unitPrice to preserve original price
          return { productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice };
        });
      }

      let updated = await updateOrder(id, payload);
      const emailMessages: string[] = [];
      const emailWarnings: string[] = [];

      if (nextStatus && nextStatus !== order!.status) {
        const statusResult = await updateOrderStatus(id, nextStatus);
        updated = statusResult.data;
        const message = emailStatusMessage(statusResult.email);
        if (message) {
          if (statusResult.email?.sent) emailMessages.push(message);
          else emailWarnings.push(message);
        }
      }

      if (nextPaymentStatus && nextPaymentStatus !== order!.paymentStatus) {
        const paymentResult = await updateOrderPaymentStatus(id, nextPaymentStatus);
        updated = paymentResult.data;
        const message = emailStatusMessage(paymentResult.email);
        if (message) {
          if (paymentResult.email?.sent) emailMessages.push(message);
          else emailWarnings.push(message);
        }
      }

      setOrder(updated);
      setEditMode(false);
      setSaveOk(true);
      setSaveMessage(emailMessages[0] ?? 'Sačuvano.');
      setSaveWarning(emailWarnings[0] ?? '');
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Greška pri čuvanju');
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    setPdfLoading(true);
    try {
      await downloadOrderPdf(id, order!.orderNumber);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Greška pri preuzimanju PDF-a');
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteOrder(id);
      router.push('/dashboard/narudzbine');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Greška pri brisanju');
      setDeleting(false);
    }
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </DashboardLayout>
    );
  }

  if (error || !order) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <ShoppingCart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-destructive">{error || 'Narudžbina nije pronađena.'}</p>
          <button onClick={() => router.push('/dashboard/narudzbine')} className="mt-4 text-sm text-primary hover:underline">
            ← Nazad na narudžbine
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground font-mono">{order.orderNumber}</h1>
              <p className="text-xs text-muted-foreground">
                {formatDate(order.createdAt)} · {order.user?.firstName} {order.user?.lastName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* PDF button — always visible */}
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              title="Preuzmi PDF"
              className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              <span className="hidden sm:inline">PDF</span>
            </button>

            {editMode ? (
              <>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="px-3 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Odustani
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors font-medium"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Čuvanje...' : 'Sačuvaj'}
                </button>
              </>
            ) : (
              <>
                {saveOk && (
                  <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                    <Check className="w-3.5 h-3.5" /> {saveMessage || 'Sačuvano'}
                  </span>
                )}
                {confirmDelete ? (
                  <>
                    <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
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
                    title="Obriši narudžbinu"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => enterEdit(order)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium"
                >
                  <Pencil className="w-4 h-4" />
                  Izmeni
                </button>
              </>
            )}
          </div>
        </div>

        {saveErr && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{saveErr}</div>
        )}

        {saveWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">{saveWarning}</div>
        )}

        {/* Two-column grid */}
        <div className="grid lg:grid-cols-8 gap-4">

          {/* ── Left column ── */}
          <div className="lg:col-span-5 space-y-4">

            {/* Kupac */}
            <Section title="Kupac">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Ime">
                  {editMode
                    ? <input value={guestFirstName} onChange={(e) => setGuestFirstName(e.target.value)} className={INPUT} placeholder="Ime" />
                    : <ViewValue value={order.user?.firstName} />
                  }
                </Field>
                <Field label="Prezime">
                  {editMode
                    ? <input value={guestLastName} onChange={(e) => setGuestLastName(e.target.value)} className={INPUT} placeholder="Prezime" />
                    : <ViewValue value={order.user?.lastName} />
                  }
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Email">
                  {editMode
                    ? <input value={form.guestEmail ?? ''} onChange={(e) => setF('guestEmail', e.target.value)} className={INPUT} placeholder="email@primer.rs" type="email" />
                    : <ViewValue value={order.user?.email} />
                  }
                </Field>
                <Field label="Telefon">
                  {editMode
                    ? <input value={form.guestPhone ?? ''} onChange={(e) => setF('guestPhone', e.target.value)} className={INPUT} placeholder="+381..." />
                    : <ViewValue value={order.user?.phone} />
                  }
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Naziv firme">
                  {editMode
                    ? <input value={form.companyName ?? ''} onChange={(e) => setF('companyName', e.target.value)} className={INPUT} placeholder="d.o.o." />
                    : <ViewValue value={order.companyName} />
                  }
                </Field>
                <Field label="PIB">
                  {editMode
                    ? <input value={form.pib ?? ''} onChange={(e) => setF('pib', e.target.value)} className={INPUT} placeholder="123456789" />
                    : <ViewValue value={order.pib} />
                  }
                </Field>
                <Field label="MB">
                  {editMode
                    ? <input value={form.mb ?? ''} onChange={(e) => setF('mb', e.target.value)} className={INPUT} placeholder="12345678" />
                    : <ViewValue value={order.mb} />
                  }
                </Field>
              </div>
            </Section>

            {/* Artikli */}
            <Section title="Artikli">
              {editMode ? (
                <div className="space-y-2">
                  {editItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nema artikala.</p>
                  )}
                  {editItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 border border-border rounded-xl bg-muted/20">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
                        {item.productSku && <p className="text-xs text-muted-foreground mt-0.5">{item.productSku}</p>}
                        {item.isNew && <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded mt-0.5 inline-block">Novi</span>}
                      </div>
                      {/* Quantity */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => updateItem(idx, { quantity: Math.max(1, item.quantity - 1) })} className="p-1 rounded-lg border border-border hover:bg-muted transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number" min={1} value={item.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                          className={'w-14 text-center text-sm border border-border rounded-lg px-2 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-primary/40' + NO_SPIN}
                        />
                        <button type="button" onClick={() => updateItem(idx, { quantity: item.quantity + 1 })} className="p-1 rounded-lg border border-border hover:bg-muted transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      {/* Unit price — editable only for existing items */}
                      {item.isNew ? (
                        <span className="text-xs text-muted-foreground w-28 text-right shrink-0">Cena iz baze</span>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number" min={0} value={item.unitPrice}
                            onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) || 0 })}
                            className={'w-28 text-right text-sm border border-border rounded-xl px-3 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-primary/40' + NO_SPIN}
                          />
                          <span className="text-xs text-muted-foreground">RSD</span>
                        </div>
                      )}
                      <button type="button" onClick={() => removeItem(idx)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Add product */}
                  {showSearch ? (
                    <div className="pt-1">
                      <ProductSearch onAdd={addProduct} />
                      <button onClick={() => setShowSearch(false)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">
                        Otkaži
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSearch(true)}
                      className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium mt-1"
                    >
                      <Plus className="w-4 h-4" /> Dodaj artikal
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium text-foreground">{item.product?.name ?? item.productName}</p>
                        {item.product?.sku && <p className="text-xs text-muted-foreground mt-0.5">{item.product.sku}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">{item.quantity} × {formatPrice(item.unitPrice)}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground whitespace-nowrap">{formatPrice(item.totalPrice)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div className="border-t border-border pt-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Međuzbir</span>
                  <span>{formatPrice(order.subtotalAmount)}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-primary">
                    <span>Popust{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                    <span>−{formatPrice(order.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dostava</span>
                  <span>{order.shippingCost > 0 ? formatPrice(order.shippingCost) : 'Besplatno'}</span>
                </div>
                <div className="flex justify-between text-base font-semibold pt-1.5 border-t border-border">
                  <span>Ukupno</span>
                  <span>{formatPrice(order.totalAmount)}</span>
                </div>
              </div>
            </Section>

          </div>

          {/* ── Right column ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Status */}
            <Section title="Status narudžbine">
              <Field label="Status">
                {editMode ? (
                  <select value={form.status} onChange={(e) => setF('status', e.target.value as OrderStatus)} className={SELECT}>
                    {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ORDER_STATUS_DOT[order.status]}`} />
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                )}
              </Field>
              <Field label="Status uplate">
                {editMode ? (
                  <select value={form.paymentStatus} onChange={(e) => setF('paymentStatus', e.target.value as PaymentStatus)} className={SELECT}>
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : (
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLORS[order.paymentStatus]}`}>
                    {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                  </span>
                )}
              </Field>
              <Field label="Način plaćanja">
                {editMode ? (
                  <select value={form.paymentMethod} onChange={(e) => setF('paymentMethod', e.target.value)} className={SELECT}>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : (
                  <ViewValue value={PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} />
                )}
              </Field>
            </Section>

            {/* Adresa */}
            <Section title="Adresa dostave">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Grad">
                  {editMode
                    ? (
                      <CityAutocomplete
                        value={form.shippingCity ?? ''}
                        onChange={(v) => {
                          setF('shippingCity', v);
                          setF('shippingAddress', '');
                          setF('shippingZipCode', '');
                          setSelectedShippingCity('');
                          setSelectedShippingAddress('');
                        }}
                        onSelect={(city, postcode) => {
                          setF('shippingCity', city);
                          setF('shippingZipCode', postcode);
                          setF('shippingAddress', '');
                          setSelectedShippingCity(city);
                          setSelectedShippingAddress('');
                        }}
                      />
                    )
                    : <ViewValue value={order.shippingCity} />
                  }
                </Field>
                <Field label="Poštanski broj">
                  {editMode
                    ? <input value={form.shippingZipCode ?? ''} onChange={(e) => setF('shippingZipCode', e.target.value)} className={INPUT} placeholder="11000" />
                    : <ViewValue value={order.shippingZipCode} />
                  }
                </Field>
              </div>
              <Field label="Ulica i broj">
                {editMode
                  ? (
                    <AddressAutocomplete
                      value={form.shippingAddress ?? ''}
                      city={form.shippingCity ?? ''}
                      disabled={!selectedShippingCity}
                      onChange={(v) => {
                        setF('shippingAddress', v);
                        setSelectedShippingAddress('');
                      }}
                      onSelect={(address, postcode) => {
                        setF('shippingAddress', address);
                        setF('shippingZipCode', postcode);
                        setSelectedShippingAddress(address);
                      }}
                    />
                  )
                  : <ViewValue value={order.shippingAddress} />
                }
              </Field>
              <Field label="Država">
                <ViewValue value="Srbija" />
              </Field>
              <Field label="Trošak dostave">
                {editMode ? (
                  <input type="number" min={0} value={form.shippingCost ?? 0} onChange={(e) => setF('shippingCost', Number(e.target.value))} className={INPUT + NO_SPIN} />
                ) : (
                  <ViewValue value={order.shippingCost > 0 ? formatPrice(order.shippingCost) : 'Besplatno'} />
                )}
              </Field>
            </Section>

            {/* Popust */}
            <Section title="Popust">
              <Field label="Kupon kod">
                {editMode
                  ? <input value={form.couponCode ?? ''} onChange={(e) => setF('couponCode', e.target.value)} className={INPUT} placeholder="PROMO10" />
                  : <ViewValue value={order.couponCode} />
                }
              </Field>
              <Field label="Iznos popusta">
                {editMode ? (
                  <input type="number" min={0} value={form.discountAmount ?? 0} onChange={(e) => setF('discountAmount', Number(e.target.value))} className={INPUT + NO_SPIN} />
                ) : (
                  <ViewValue value={order.discountAmount > 0 ? formatPrice(order.discountAmount) : null} />
                )}
              </Field>
            </Section>

            {/* Napomena */}
            <Section title="Napomena">
              {editMode ? (
                <textarea
                  value={form.notes ?? ''}
                  onChange={(e) => setF('notes', e.target.value)}
                  placeholder="Napomena za narudžbinu..."
                  rows={4}
                  className={INPUT + ' resize-none'}
                />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap min-h-[2rem]">
                  {order.notes || <span className="text-muted-foreground">—</span>}
                </p>
              )}
            </Section>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
