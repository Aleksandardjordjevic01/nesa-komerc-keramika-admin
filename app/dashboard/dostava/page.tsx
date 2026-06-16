'use client';

import { useEffect, useState } from 'react';
import { Truck, Plus, Pencil, Trash2, Loader2, X, GripVertical } from 'lucide-react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import { SelectDropdown } from '../../../components/shared/select-dropdown';
import { getShippingMethods, createShippingMethod, updateShippingMethod, deleteShippingMethod, type ShippingMethod, type ShippingMethodPayload, type ShippingType } from '../../../lib/api/client';

const TYPE_LABELS: Record<ShippingType, string> = {
  courier: 'Kurirska služba',
  vehicle: 'Dostava vozilom',
  pickup: 'Lično preuzimanje',
};

function formatPrice(n: number) {
  if (n === 0) return 'Besplatno';
  return new Intl.NumberFormat('sr-Latn-RS', { style: 'currency', currency: 'RSD', maximumFractionDigits: 0 }).format(n);
}

const EMPTY_FORM: ShippingMethodPayload = {
  type: 'courier', name: '', description: null, price: 0, freeAbove: null, isActive: true, sortOrder: 0,
};

export default function DostavaPage() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShippingMethod | null>(null);
  const [form, setForm] = useState<ShippingMethodPayload>(EMPTY_FORM);
  const [hasFreeShipping, setHasFreeShipping] = useState(false);
  const [freeAbove, setFreeAbove] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try { setMethods((await getShippingMethods()).sort((a, b) => a.sortOrder - b.sortOrder)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Greška'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setHasFreeShipping(false);
    setFreeAbove('');
    setShowForm(true);
  }
  function openEdit(m: ShippingMethod) {
    setEditing(m);
    setForm({ type: m.type, name: m.name, description: m.description, price: m.price, freeAbove: m.freeAbove, isActive: m.isActive, sortOrder: m.sortOrder });
    setHasFreeShipping(m.freeAbove !== null && m.freeAbove !== undefined);
    setFreeAbove(m.freeAbove != null ? String(m.freeAbove) : '');
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { ...form, freeAbove: hasFreeShipping ? Number(freeAbove) : null };
      if (editing) await updateShippingMethod(editing.id, payload);
      else await createShippingMethod({ ...payload, sortOrder: methods.length });
      setShowForm(false); load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Greška'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try { await deleteShippingMethod(deleteId); setDeleteId(null); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Greška'); }
    finally { setDeleting(false); }
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragOverIndex !== index) setDragOverIndex(index);
  }

  async function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const reordered = [...methods];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setMethods(reordered);
    setDragIndex(null); setDragOverIndex(null);
    setReordering(true);
    try {
      await Promise.all(reordered.map((m, i) => updateShippingMethod(m.id, { sortOrder: i })));
    } catch {
      load();
    } finally {
      setReordering(false);
    }
  }

  function handleDragEnd() {
    setDragIndex(null); setDragOverIndex(null);
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Načini dostave
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {methods.length} metoda dostave{reordering && <span className="ml-2 text-xs text-muted-foreground"><Loader2 className="inline w-3 h-3 animate-spin mr-1" />Čuvanje redosleda...</span>}
            </p>
          </div>
          <button onClick={openNew}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors sm:shrink-0">
            <Plus className="w-4 h-4" />Nova metoda
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">{error}</div>
        ) : methods.length === 0 ? (
          <div className="bg-card border border-border rounded-xl text-center py-12 text-muted-foreground">
            Nema metoda dostave. Dodajte prvu metodu.
          </div>
        ) : (
          <div className="grid gap-4">
            {methods.map((m, index) => (
              <div
                key={m.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`bg-card border rounded-xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4 transition-all ${
                  dragOverIndex === index && dragIndex !== index
                    ? 'border-primary shadow-md scale-[1.01]'
                    : dragIndex === index
                    ? 'border-border opacity-50'
                    : 'border-border'
                }`}
              >
                <div className="flex items-center self-stretch cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors pt-0.5">
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5 mb-1">
                    <span className="font-semibold text-foreground">{m.name}</span>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{TYPE_LABELS[m.type]}</span>
                    {!m.isActive && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Neaktivno</span>}
                  </div>
                  {m.description && <p className="text-sm text-muted-foreground mb-2">{m.description}</p>}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-medium">{formatPrice(m.price)}</span>
                    {m.freeAbove && <span className="text-muted-foreground">Besplatno iznad {formatPrice(m.freeAbove)}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteId(m.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">{editing ? 'Izmeni metodu' : 'Nova metoda dostave'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Tip</p>
                <SelectDropdown
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v as ShippingType })}
                  options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Naziv</p>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="npr. Express dostava"
                  className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              {form.type !== 'pickup' && (
                <>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Opis (opciono)</p>
                    <input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value || null })} placeholder="npr. Dostava 1-3 radna dana"
                      className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Cena (RSD)</p>
                    <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} min={0}
                      className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-sm font-medium">Besplatna poštarina</span>
                    <button type="button" onClick={() => { setHasFreeShipping(!hasFreeShipping); if (hasFreeShipping) setFreeAbove(''); }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${hasFreeShipping ? 'bg-primary' : 'bg-border'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${hasFreeShipping ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {hasFreeShipping && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Besplatno iznad (RSD)</p>
                      <input type="number" value={freeAbove} onChange={(e) => setFreeAbove(e.target.value)} min={0} placeholder="npr. 5000"
                        className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium">Aktivno</span>
                <button type="button" onClick={() => setForm({ ...form, isActive: !(form.isActive ?? true) })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.isActive ?? true ? 'bg-primary' : 'bg-border'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ?? true ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 px-4 sm:px-6 pb-4 sm:pb-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 text-sm border border-border rounded-xl hover:bg-muted transition-colors">Odustani</button>
              <button onClick={handleSave} disabled={saving || !form.name}
                className="flex-1 py-3 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? 'Sačuvaj izmene' : 'Kreiraj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Obriši metodu dostave</h3>
            <p className="text-sm text-muted-foreground mb-6">Da li ste sigurni? Ova akcija se ne može poništiti.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Odustani</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-60 transition-colors flex items-center gap-2">
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Obriši
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
