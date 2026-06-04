'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquareDashed, ChevronLeft, ChevronRight, Eye, Loader2, X, CheckCircle2, XCircle, Clock, Plus, Search } from 'lucide-react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import { SelectDropdown } from '../../../components/shared/select-dropdown';
import { getComplaints, updateComplaintStatus, createAdminComplaint, searchUsers, type Complaint, type ComplaintStatus, type ComplaintsParams, type CreateAdminComplaintInput, type UserSearchResult } from '../../../lib/api/client';

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending: 'Na čekanju', accepted: 'Prihvaćena', rejected: 'Odbijena',
};

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_ICONS: Record<ComplaintStatus, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  accepted: <CheckCircle2 className="w-3.5 h-3.5" />,
  rejected: <XCircle className="w-3.5 h-3.5" />,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReklamacijePage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [saving, setSaving] = useState(false);

  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [createModal, setCreateModal] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [creating, setCreating] = useState(false);
  const emptyForm: CreateAdminComplaintInput = { subject: '', description: '', userEmail: '', userPhone: '', guestName: '', guestPhone: '', guestEmail: '', orderNumber: '', adminNotes: '' };
  const [form, setForm] = useState<CreateAdminComplaintInput>(emptyForm);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const userSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: ComplaintsParams = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter as ComplaintStatus;
      const res = await getComplaints(params);
      setComplaints(res.data); setMeta(res.meta);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Greška'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openDetail(c: Complaint) {
    setSelected(c);
    setAdminResponse(c.adminResponse ?? '');
  }

  async function handleStatusUpdate(status: ComplaintStatus) {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateComplaintStatus(selected.id, status, adminResponse || undefined);
      setSelected(updated);
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Greška'); }
    finally { setSaving(false); }
  }

  function openCreateModal() {
    setForm(emptyForm);
    setIsGuest(false);
    setUserQuery('');
    setUserResults([]);
    setSelectedUser(null);
    setCreateModal(true);
  }

  function handleUserSearch(q: string) {
    setUserQuery(q);
    setSelectedUser(null);
    setForm((f) => ({ ...f, userId: undefined }));
    if (userSearchTimer.current) clearTimeout(userSearchTimer.current);
    if (q.length < 2) { setUserResults([]); return; }
    userSearchTimer.current = setTimeout(async () => {
      setUserSearching(true);
      try { setUserResults(await searchUsers(q)); }
      catch { setUserResults([]); }
      finally { setUserSearching(false); }
    }, 300);
  }

  function selectUser(u: UserSearchResult) {
    setSelectedUser(u);
    setForm((f) => ({ ...f, userId: u.id, userEmail: undefined, userPhone: undefined }));
    setUserQuery('');
    setUserResults([]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) return;
    setCreating(true);
    try {
      const payload: CreateAdminComplaintInput = { subject: form.subject, description: form.description };
      if (form.adminNotes?.trim()) payload.adminNotes = form.adminNotes;
      if (form.orderNumber?.trim()) payload.orderNumber = form.orderNumber;
      if (isGuest) {
        if (form.guestName?.trim()) payload.guestName = form.guestName;
        if (form.guestEmail?.trim()) payload.guestEmail = form.guestEmail;
        if (form.guestPhone?.trim()) payload.guestPhone = form.guestPhone;
      } else {
        if (form.userId) payload.userId = form.userId;
        if (form.userEmail?.trim()) payload.userEmail = form.userEmail;
        if (form.userPhone?.trim()) payload.userPhone = form.userPhone;
      }
      await createAdminComplaint(payload);
      setCreateModal(false);
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Greška pri kreiranju reklamacije'); }
    finally { setCreating(false); }
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <MessageSquareDashed className="w-5 h-5 text-primary" />
              Reklamacije
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{meta.total} reklamacija ukupno</p>
          </div>
          <button onClick={openCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors sm:shrink-0">
            <Plus className="w-4 h-4" />
            Nova reklamacija
          </button>
        </div>

        {/* Filter */}
        <SelectDropdown value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={[{ value: '', label: 'Svi statusi' }, ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
          className="w-full sm:w-44" />

        <div className="bg-card border border-border rounded-xl overflow-hidden">

          {/* Card view — mobile / tablet */}
          <div className="lg:hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : error ? (
              <div className="text-center py-12 text-destructive">{error}</div>
            ) : complaints.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nema reklamacija.</div>
            ) : (
              complaints.map((c) => (
                <div key={c.id} className="flex items-start gap-3 px-4 py-3.5 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">
                        {c.user?.firstName} {c.user?.lastName}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                        {STATUS_ICONS[c.status]}{STATUS_LABELS[c.status]}
                      </span>
                    </div>
                    {c.user?.email && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.user.email}</div>
                    )}
                    <div className="text-sm font-medium mt-1.5 truncate">{c.subject}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.description}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(c.createdAt)}{c.order ? ` · ${c.order.orderNumber}` : ''}
                    </div>
                  </div>
                  <button onClick={() => openDetail(c)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 mt-0.5">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Table view — desktop */}
          <div className="hidden lg:block">
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : error ? (
              <div className="text-center py-12 text-destructive">{error}</div>
            ) : complaints.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nema reklamacija.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">KUPAC</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">NARUDŽBINA</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">PREDMET</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">STATUS</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">DATUM</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">AKCIJE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {complaints.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{c.user?.firstName} {c.user?.lastName}</div>
                          <div className="text-xs text-muted-foreground">{c.user?.email}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{c.order?.orderNumber ?? '—'}</td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="truncate font-medium">{c.subject}</div>
                          <div className="truncate text-xs text-muted-foreground">{c.description}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                            {STATUS_ICONS[c.status]}{STATUS_LABELS[c.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(c.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <button onClick={() => openDetail(c)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                              <Eye className="w-4 h-4" />
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
          {!loading && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-sm text-muted-foreground">Strana {meta.page} od {meta.totalPages}</span>
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

      {selected && (        <div className="fixed inset-0 bg-black/50 flex justify-end z-50" onClick={() => setSelected(null)}>
          <div className="bg-card w-full max-w-lg h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Reklamacija</h2>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status]}`}>
                  {STATUS_ICONS[selected.status]}{STATUS_LABELS[selected.status]}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(selected.createdAt)}</span>
              </div>

              <div className="bg-muted/30 rounded-xl p-4 space-y-1">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Kupac</h3>
                <p className="text-sm font-medium">{selected.user?.firstName} {selected.user?.lastName}</p>
                <p className="text-sm text-muted-foreground">{selected.user?.email}</p>
              </div>

              {selected.order && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Narudžbina</h3>
                  <p className="text-sm font-mono">{selected.order.orderNumber}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-1">{selected.subject}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Admin odgovor</label>
                <textarea value={adminResponse} onChange={(e) => setAdminResponse(e.target.value)} rows={4}
                  className="mt-1 w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Unesite odgovor kupcu..." />
              </div>

              <div className="flex gap-3">
                <button onClick={() => handleStatusUpdate('accepted')} disabled={saving || selected.status === 'accepted'}
                  className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Prihvati
                </button>
                <button onClick={() => handleStatusUpdate('rejected')} disabled={saving || selected.status === 'rejected'}
                  className="flex-1 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Odbij
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={() => setCreateModal(false)}>
          <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
              <h2 className="text-base sm:text-lg font-semibold">Nova reklamacija</h2>
              <button onClick={() => setCreateModal(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 overflow-y-auto max-h-[85vh] sm:max-h-[80vh]">

              {/* Tip korisnika */}
              <div className="flex rounded-xl border border-border overflow-hidden text-sm font-medium">
                <button type="button" onClick={() => setIsGuest(false)}
                  className={`flex-1 py-2.5 transition-colors ${!isGuest ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                  Registrovan korisnik
                </button>
                <button type="button" onClick={() => setIsGuest(true)}
                  className={`flex-1 py-2.5 transition-colors ${isGuest ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                  Gost
                </button>
              </div>

              {/* Podaci o korisniku */}
              {!isGuest ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Korisnik</p>
                  {selectedUser ? (
                    <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/30 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{selectedUser.firstName} {selectedUser.lastName}</div>
                        <div className="text-xs text-muted-foreground truncate">{selectedUser.email}{selectedUser.phone ? ` · ${selectedUser.phone}` : ''}</div>
                      </div>
                      <button type="button" onClick={() => { setSelectedUser(null); setForm((f) => ({ ...f, userId: undefined })); }}
                        className="p-1 rounded-lg hover:bg-muted transition-colors flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      {userSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                      <input type="text" placeholder="Pretraži po imenu, emailu, telefonu..." value={userQuery}
                        onChange={(e) => handleUserSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      {userResults.length > 0 && (
                        <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                          {userResults.map((u) => (
                            <button key={u.id} type="button" onClick={() => selectUser(u)}
                              className="w-full flex flex-col items-start px-4 py-2.5 hover:bg-muted/60 transition-colors text-left border-b border-border last:border-0">
                              <span className="text-sm font-medium">{u.firstName} {u.lastName}</span>
                              <span className="text-xs text-muted-foreground">{u.email}{u.phone ? ` · ${u.phone}` : ''}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {userQuery.length >= 2 && !userSearching && userResults.length === 0 && (
                        <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg px-4 py-3 text-sm text-muted-foreground">
                          Nema rezultata
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Podaci gosta</p>
                  <input type="text" placeholder="Ime i prezime *" value={form.guestName ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                    className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <input type="email" placeholder="Email gosta" value={form.guestEmail ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, guestEmail: e.target.value }))}
                    className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <input type="text" placeholder="Telefon gosta" value={form.guestPhone ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, guestPhone: e.target.value }))}
                    className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              )}

              {/* Narudžbina */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Narudžbina</p>
                <input type="text" placeholder="Broj narudžbine (npr. NK-030842)" value={form.orderNumber ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))}
                  className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono" />
              </div>

              {/* Reklamacija */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Reklamacija</p>
                <input type="text" placeholder="Predmet *" required value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 mb-3" />
                <textarea rows={3} placeholder="Opis *" required value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
              </div>

              {/* Admin beleška */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Admin beleška</p>
                <textarea rows={2} placeholder="Npr. Pozivan je 19.05. u 14:30" value={form.adminNotes ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, adminNotes: e.target.value }))}
                  className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setCreateModal(false)}
                  className="flex-1 py-3 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
                  Otkaži
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-3 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Kreiraj reklamaciju
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
