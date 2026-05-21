'use client';

import { useEffect, useState } from 'react';
import { Percent, Plus, Pencil, Trash2, Loader2, X, CheckCircle2, XCircle } from 'lucide-react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import { SelectDropdown } from '../../../components/shared/select-dropdown';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon, type Coupon, type CouponPayload, type DiscountType } from '../../../lib/api/client';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' });
}

const EMPTY_FORM: CouponPayload = {
  code: '', discountType: 'percentage', discountValue: 0,
  minOrderAmount: null, maxUsage: null, isActive: true, expiresAt: null,
};

export default function KuponiPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try { setCoupons(await getCoupons()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Greška'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }
  function openEdit(c: Coupon) {
    setEditing(c);
    setForm({ code: c.code, discountType: c.discountType, discountValue: c.discountValue, minOrderAmount: c.minOrderAmount, maxUsage: c.maxUsage, isActive: c.isActive, expiresAt: c.expiresAt });
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) await updateCoupon(editing.id, form);
      else await createCoupon(form);
      setShowForm(false);
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Greška'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try { await deleteCoupon(deleteId); setDeleteId(null); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Greška'); }
    finally { setDeleting(false); }
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              Kuponi
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{coupons.length} kupona ukupno</p>
          </div>
          <button onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />Novi kupon
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nema kupona. Kreirajte prvi kupon.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">KOD</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">POPUST</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">MIN. IZNOS</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">ISKORIŠĆENO</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">ISTIČE</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">STATUS</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">AKCIJE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {coupons.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                      <td className="px-4 py-3">
                        {c.discountType === 'percentage' ? `${c.discountValue}%` : `${c.discountValue} RSD`}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.minOrderAmount ? `${c.minOrderAmount} RSD` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.usageCount}{c.maxUsage ? ` / ${c.maxUsage}` : ''}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(c.expiresAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${c.isActive ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                            {c.isActive ? <><CheckCircle2 className="w-3 h-3" />Aktivan</> : <><XCircle className="w-3 h-3" />Neaktivan</>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">{editing ? 'Izmeni kupon' : 'Novi kupon'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Kod kupona</p>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="npr. LJETO20"
                  className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Tip popusta</p>
                  <SelectDropdown
                    value={form.discountType}
                    onChange={(v) => setForm({ ...form, discountType: v as DiscountType })}
                    options={[{ value: 'percentage', label: 'Procenat (%)' }, { value: 'fixed', label: 'Fiksni (RSD)' }]}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Vrednost</p>
                  <input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} min={0}
                    className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Min. iznos narudžbine</p>
                  <input type="number" value={form.minOrderAmount ?? ''} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value ? Number(e.target.value) : null })} min={0} placeholder="—"
                    className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Maks. upotreba</p>
                  <input type="number" value={form.maxUsage ?? ''} onChange={(e) => setForm({ ...form, maxUsage: e.target.value ? Number(e.target.value) : null })} min={1} placeholder="Neograničeno"
                    className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Datum isteka</p>
                <input type="datetime-local" value={form.expiresAt ? form.expiresAt.slice(0, 16) : ''} onChange={(e) => setForm({ ...form, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium">Aktivan kupon</span>
                <button type="button" onClick={() => setForm({ ...form, isActive: !(form.isActive ?? true) })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.isActive ?? true ? 'bg-primary' : 'bg-border'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ?? true ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 text-sm border border-border rounded-xl hover:bg-muted transition-colors">Odustani</button>
              <button onClick={handleSave} disabled={saving || !form.code || form.discountValue <= 0}
                className="flex-1 py-3 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? 'Sačuvaj izmene' : 'Kreiraj kupon'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">Obriši kupon</h3>
              <button onClick={() => setDeleteId(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-muted-foreground mb-6">Da li ste sigurni? Ova akcija se ne može poništiti.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-3 text-sm border border-border rounded-xl hover:bg-muted transition-colors">Odustani</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-3 text-sm bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}Obriši
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
