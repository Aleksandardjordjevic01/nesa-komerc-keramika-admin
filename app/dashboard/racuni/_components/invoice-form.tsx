'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Loader2, Printer, Search, Building2, User } from 'lucide-react';
import { DashboardLayout } from '../../../../components/layout/dashboard-layout';
import { SelectDropdown } from '../../../../components/shared/select-dropdown';
import {
  createInvoice, updateInvoice, searchUsers, getProducts,
  type Invoice, type InvoiceItem, type InvoiceType, type InvoiceStatus, type UserSearchResult, type Product,
} from '../../../../lib/api/client';

type ClientType = 'pravno' | 'fizicko';

// ─── Product search per item ──────────────────────────────────────────────────
function ProductSearchInput({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (p: Product) => void;
}) {
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen]       = useState(false);
  const [rect, setRect]       = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await getProducts({ search: value.trim(), limit: 8 });
        setResults(res.data);
        if (res.data.length > 0) {
          setRect(inputRef.current?.getBoundingClientRect() ?? null);
          setOpen(true);
        } else {
          setOpen(false);
        }
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, []);

  function pick(p: Product) {
    onSelect(p);
    setOpen(false);
    setResults([]);
  }

  const dropdown = open && rect && typeof document !== 'undefined'
    ? createPortal(
        <div
          style={(() => {
            const maxH = 280;
            const spaceBelow = window.innerHeight - rect.bottom - 8;
            const spaceAbove = rect.top - 8;
            const showAbove = spaceBelow < maxH && spaceAbove > spaceBelow;
            return {
              position: 'fixed' as const,
              top: showAbove ? undefined : rect.bottom + 4,
              bottom: showAbove ? window.innerHeight - rect.top + 4 : undefined,
              left: rect.left,
              width: Math.max(rect.width, 480),
              maxHeight: maxH,
              zIndex: 9999,
            };
          })()}
          className="bg-card border border-border rounded-xl shadow-xl overflow-y-auto"
        >
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => pick(p)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/40 last:border-0 gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.category?.name}{p.sku ? ` · ${p.sku}` : ''}</p>
              </div>
              <span className="text-sm font-semibold text-foreground whitespace-nowrap shrink-0">
                {new Intl.NumberFormat('sr-Latn-RS', { minimumFractionDigits: 2 }).format(Number(p.salePrice ?? p.price))} RSD
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Opis artikla / usluge"
        className="w-full px-3 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {dropdown}
    </>
  );
}

const INPUT = 'w-full px-3 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40';
const INPUT_SM = 'w-full px-3 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40';


const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft',     label: 'Nacrt'   },
  { value: 'issued',    label: 'Izdat'   },
  { value: 'paid',      label: 'Plaćen'  },
  { value: 'cancelled', label: 'Otkazan' },
];

function formatPrice(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyItem(): InvoiceItem {
  return { description: '', unit: 'kom', quantity: 1, unitPrice: 0, discount: 0, total: 0 };
}

function calcItem(item: InvoiceItem): InvoiceItem {
  const base = item.quantity * item.unitPrice * (1 - (item.discount ?? 0) / 100);
  return { ...item, total: base };
}

interface Props {
  initial?: Invoice;
}

export default function InvoiceForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial;

  const [type, setType]           = useState<InvoiceType>(initial?.type ?? 'racun');
  const [status, setStatus]       = useState<InvoiceStatus>(initial?.status ?? 'draft');
  const [issueDate, setIssueDate] = useState(initial?.issueDate?.slice(0, 10) ?? today());
  const [dueDate, setDueDate]     = useState(initial?.dueDate?.slice(0, 10) ?? '');
  const [notes, setNotes]         = useState(initial?.notes ?? '');

  // Klijent
  const [clientName,    setClientName]    = useState(initial?.clientName ?? '');
  const [clientAddress, setClientAddress] = useState(initial?.clientAddress ?? '');
  const [clientCity,    setClientCity]    = useState(initial?.clientCity ?? '');
  const [clientZip,     setClientZip]     = useState(initial?.clientZip ?? '');
  const [clientPib,     setClientPib]     = useState(initial?.clientPib ?? '');
  const [clientMb,      setClientMb]      = useState(initial?.clientMb ?? '');
  const [clientEmail,   setClientEmail]   = useState(initial?.clientEmail ?? '');
  const [clientPhone,   setClientPhone]   = useState(initial?.clientPhone ?? '');

  // Stavke
  const [items, setItems] = useState<InvoiceItem[]>(
    initial?.items?.length ? initial.items : [emptyItem()]
  );

  const [clientType, setClientType] = useState<ClientType>(
    initial?.clientPib || initial?.clientMb ? 'pravno' : 'fizicko'
  );

  // User search
  const [userQuery,   setUserQuery]   = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [userOpen,    setUserOpen]    = useState(false);
  const userSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userQuery.trim()) { setUserResults([]); setUserOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await searchUsers(userQuery, 8);
        setUserResults(res);
        setUserOpen(res.length > 0);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [userQuery]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (userSearchRef.current && !userSearchRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function applyUser(u: UserSearchResult) {
    setClientName(`${u.firstName} ${u.lastName}`.trim());
    setClientEmail(u.email);
    setClientPhone(u.phone ?? '');
    setClientType('fizicko');
    setClientPib('');
    setClientMb('');
    setUserQuery('');
    setUserResults([]);
    setUserOpen(false);
  }

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const hasDiscount = items.some((i) => (i.discount ?? 0) > 0);
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice * (1 - (i.discount ?? 0) / 100), 0);

  function updateItem(idx: number, field: keyof InvoiceItem, raw: string | number) {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: typeof raw === 'string' && field !== 'description' && field !== 'unit' ? Number(raw) : raw };
      next[idx] = calcItem(item);
      return next;
    });
  }

  function addItem() { setItems((p) => [...p, emptyItem()]); }
  function removeItem(idx: number) { setItems((p) => p.filter((_, i) => i !== idx)); }

  async function handleSave() {
    if (!clientName.trim()) { setError('Naziv klijenta je obavezan.'); return; }
    if (items.length === 0) { setError('Dodajte bar jednu stavku.'); return; }

    setSaving(true); setError(null);
    try {
      const payload = {
        type, status,
        clientName: clientName.trim(),
        clientAddress: clientAddress.trim() || undefined,
        clientCity: clientCity.trim() || undefined,
        clientZip: clientZip.trim() || undefined,
        clientPib: clientPib.trim() || undefined,
        clientMb: clientMb.trim() || undefined,
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        items: items.map(calcItem),
        issueDate,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      };

      if (isEdit && initial) {
        await updateInvoice(initial.id, payload);
      } else {
        const created = await createInvoice(payload);
        router.replace(`/dashboard/racuni/${created.id}`);
        return;
      }
      router.push('/dashboard/racuni');
    } catch (e: any) {
      setError(e.message ?? 'Greška pri čuvanju');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {isEdit ? `Uredi: ${initial.invoiceNumber}` : 'Novi dokument'}
              </h1>
              {isEdit && <p className="text-xs text-muted-foreground mt-0.5">Kreirao: {initial.createdBy}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="px-4 py-2.5 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
              Odustani
            </button>
            {isEdit && (
              <button
                onClick={() => window.open(`/dashboard/racuni/${initial.id}/print`, '_blank')}
                className="flex items-center gap-2 px-3 py-2.5 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Štampaj</span>
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? 'Sačuvaj dokument' : 'Kreiraj dokument'}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 bg-destructive/10 text-destructive text-sm rounded-xl border border-destructive/20">
            {error}
          </div>
        )}

        {/* Tip i status */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/50">
            <h2 className="text-sm font-semibold">Opšte</h2>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Tip dokumenta</p>
              <SelectDropdown
                value={type}
                onChange={(v) => setType(v as InvoiceType)}
                options={[{ value: 'racun', label: 'Račun' }, { value: 'predracun', label: 'Predračun' }]}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Status</p>
              <SelectDropdown
                value={status}
                onChange={(v) => setStatus(v as InvoiceStatus)}
                options={STATUS_OPTIONS}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Datum izdavanja</p>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={INPUT_SM} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Datum valute</p>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={INPUT_SM} />
            </div>
          </div>
        </div>

        {/* Klijent — bez overflow-hidden da dropdown ne bude clipped */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-3.5 border-b border-border/50 flex flex-wrap items-center gap-3 rounded-t-xl">
            <h2 className="text-sm font-semibold flex-1">Podaci o klijentu</h2>

            {/* Tip klijenta */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => setClientType('pravno')}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${clientType === 'pravno' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Pravno lice
              </button>
              <button
                type="button"
                onClick={() => setClientType('fizicko')}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${clientType === 'fizicko' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <User className="w-3.5 h-3.5" />
                Fizičko lice
              </button>
            </div>

            {/* Pretraži postojeće korisnike */}
            <div ref={userSearchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Pretraži korisnike..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 w-48"
                />
              </div>
              {userOpen && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                  {userResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={() => applyUser(u)}
                      className="w-full flex flex-col px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-0"
                    >
                      <span className="text-sm font-medium text-foreground">{u.firstName} {u.lastName}</span>
                      <span className="text-xs text-muted-foreground">{u.email}{u.phone ? ` · ${u.phone}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-b-xl">
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                {clientType === 'pravno' ? 'Naziv firme *' : 'Ime i prezime *'}
              </p>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={clientType === 'pravno' ? 'npr. Firma d.o.o.' : 'npr. Marko Marković'}
                className={INPUT}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Adresa</p>
              <input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Ulica i broj" className={INPUT} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Grad</p>
                <input value={clientCity} onChange={(e) => setClientCity(e.target.value)} placeholder="Beograd" className={INPUT} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">PTT</p>
                <input value={clientZip} onChange={(e) => setClientZip(e.target.value)} placeholder="11000" className={INPUT} />
              </div>
            </div>
            {clientType === 'pravno' && (
              <>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">PIB</p>
                  <input value={clientPib} onChange={(e) => setClientPib(e.target.value)} placeholder="123456789" className={INPUT} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Matični broj</p>
                  <input value={clientMb} onChange={(e) => setClientMb(e.target.value)} placeholder="12345678" className={INPUT} />
                </div>
              </>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Email</p>
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="firma@email.com" className={INPUT} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Telefon</p>
              <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+381..." className={INPUT} />
            </div>
          </div>
        </div>

        {/* Stavke — bez overflow-hidden da product dropdown ne bude clipped */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between rounded-t-xl">
            <h2 className="text-sm font-semibold">Stavke</h2>
            <button onClick={addItem} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Dodaj stavku
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Opis</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground w-20">Jedin.</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground w-20">Kol.</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-32">Cena</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground w-24">Popust %</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground w-32">Iznos</th>
                  <th className="w-10 px-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2">
                      <ProductSearchInput
                        value={item.description}
                        onChange={(v) => updateItem(idx, 'description', v)}
                        onSelect={(p) => {
                          const price = Number(p.salePrice ?? p.price);
                          setItems((prev) => {
                            const next = [...prev];
                            next[idx] = calcItem({ ...next[idx], description: p.name, unitPrice: price });
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={item.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                        className={`${INPUT_SM} text-center`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        className={`${INPUT_SM} text-center`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                        className={`${INPUT_SM} text-right`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={item.discount ?? 0}
                        onChange={(e) => updateItem(idx, 'discount', e.target.value)}
                        className={`${INPUT_SM} text-center`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap pr-4">
                      {formatPrice(item.quantity * item.unitPrice * (1 - (item.discount ?? 0) / 100))}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totali */}
          <div className="border-t border-border p-5 flex justify-end">
            <div className="w-64 text-sm">
              <div className="flex justify-between font-semibold text-foreground">
                <span>UKUPNO:</span>
                <span>{formatPrice(total)} RSD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Napomena */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/50">
            <h2 className="text-sm font-semibold">Napomena (opciono)</h2>
          </div>
          <div className="p-5">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Dodatne napomene na dokumentu..."
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
