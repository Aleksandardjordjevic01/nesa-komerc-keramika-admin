'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import { SelectDropdown } from '../../../components/shared/select-dropdown';
import {
  getAdminUsers,
  updateAdminUserStatus,
  deleteAdminUser,
  createAdminUser,
  type AdminUserListItem,
  type AdminUsersParams,
  type CreateAdminUserPayload,
} from '../../../lib/api/client';
import { Search, ChevronLeft, ChevronRight, MoreHorizontal, Eye, ToggleLeft, ToggleRight, Trash2, X, Users, UserPlus, Loader2 } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktivan',
  INACTIVE: 'Neaktivan',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-primary/10 text-primary',
  INACTIVE: 'bg-muted text-muted-foreground',
};

const ROLE_LABELS: Record<string, string> = {
  USER: 'Korisnik',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
};

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmModal({
  title,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-lg">
        <p className="text-sm font-medium text-foreground mb-6">{title}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors border border-border"
          >
            Odustani
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-60"
          >
            {loading ? 'Čekajte...' : 'Potvrdi'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create user modal ───────────────────────────────────────────────────────
const EMPTY_FORM: CreateAdminUserPayload = { firstName: '', lastName: '', email: '', password: '', phone: '', role: 'customer' };

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateAdminUserPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field: keyof CreateAdminUserPayload, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Ime, prezime, e-mail i lozinka su obavezni.');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateAdminUserPayload = { ...form };
      if (!payload.phone) delete payload.phone;
      await createAdminUser(payload);
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Greška pri kreiranju korisnika.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Novi korisnik
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Ime *</label>
              <input
                type="text"
                placeholder="Petar"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Prezime *</label>
              <input
                type="text"
                placeholder="Petrović"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                className={inputCls}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">E-mail *</label>
            <input
              type="email"
              placeholder="petar@example.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Lozinka *</label>
            <input
              type="password"
              placeholder="Minimalno 8 karaktera"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Telefon</label>
            <input
              type="tel"
              placeholder="+381 60 000 0000"
              value={form.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Uloga</label>
            <SelectDropdown
              value={form.role ?? 'customer'}
              onChange={(v) => set('role', v)}
              options={[
                { value: 'customer', label: 'Korisnik' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground hover:bg-muted transition-colors"
            >
              Otkaži
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Kreiraj
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Row actions dropdown ──────────────────────────────────────────────────────
function ActionsMenu({
  user,
  onToggle,
  onDelete,
}: {
  user: AdminUserListItem;
  onToggle: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((p) => !p);
  }

  return (
    <div>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        aria-label="Akcije"
      >
        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
      </button>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-48 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
            style={{ top: pos.top, right: pos.right }}
          >
            <Link
              href={`/dashboard/korisnici/${user.id}`}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              Pregledaj
            </Link>
            <button
              onClick={() => { setOpen(false); onToggle(user.id); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              {user.status === 'ACTIVE'
                ? <><ToggleRight className="w-3.5 h-3.5 text-muted-foreground" />Deaktiviraj</>
                : <><ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />Aktiviraj</>}
            </button>
            <button
              onClick={() => { setOpen(false); onDelete(user.id, user.displayName); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors border-t border-border"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Obriši
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function KorisniciPage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  // Debounce search input → search state
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [confirm, setConfirm] = useState<{ type: 'toggle' | 'delete'; id: string; label: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    const params: AdminUsersParams = { page, limit: 20 };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (roleFilter) params.role = roleFilter;

    try {
      const res = await getAdminUsers(params);
      setUsers(res.data);
      setMeta(res.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Nije moguće učitati korisnike.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, roleFilter]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handleToggleRequest(id: string) {
    setConfirm({ type: 'toggle', id, label: 'Da li želite da promenite status korisnika?' });
  }

  function handleDeleteRequest(id: string, name: string) {
    setConfirm({ type: 'delete', id, label: `Da li želite da obrišete korisnika "${name}"? Ova akcija je nepovratna.` });
  }

  async function handleConfirmAction() {
    if (!confirm) return;
    setActionLoading(true);
    try {
      if (confirm.type === 'toggle') {
        await updateAdminUserStatus(confirm.id, 'ACTIVE');
        showToast('Status korisnika je promenjen.');
      } else {
        await deleteAdminUser(confirm.id);
        showToast('Korisnik je obrisan.');
      }
      setConfirm(null);
      void fetchUsers();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Greška.');
    } finally {
      setActionLoading(false);
    }
  }

  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('sr-Latn-RS', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Korisnici</h1>
            {!loading && (
              <p className="text-sm text-muted-foreground mt-0.5">{meta.total} korisnika ukupno</p>
            )}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors sm:shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Novi korisnik
          </button>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search */}
          <div className="relative w-full lg:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pretraži po imenu, e-mailu, telefonu..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Dropdowns row */}
          <div className="flex flex-wrap gap-3 lg:flex-nowrap lg:shrink-0">
            <SelectDropdown
              className="min-w-[140px] flex-1 sm:w-44 sm:flex-none"
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={[
                { value: '', label: 'Svi statusi' },
                { value: 'ACTIVE', label: 'Aktivni' },
                { value: 'INACTIVE', label: 'Neaktivni' },
              ]}
            />
            <SelectDropdown
              className="min-w-[140px] flex-1 sm:w-40 sm:flex-none"
              value={roleFilter}
              onChange={(v) => { setRoleFilter(v); setPage(1); }}
              options={[
                { value: '', label: 'Sve uloge' },
                { value: 'USER', label: 'Korisnik' },
                { value: 'ADMIN', label: 'Admin' },
                { value: 'SUPER_ADMIN', label: 'Super Admin' },
              ]}
            />
            {(searchInput || statusFilter || roleFilter) && (
              <button
                onClick={() => { setSearchInput(''); setStatusFilter(''); setRoleFilter(''); setPage(1); }}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" /> Resetuj
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
        )}

        {/* Table / Cards */}
        <div className="bg-card border border-border rounded-xl overflow-hidden card-shadow">

          {/* Card view — mobile / tablet */}
          <div className="lg:hidden">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
                  <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-muted rounded animate-pulse w-1/2" />
                    <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                  </div>
                </div>
              ))
            ) : users.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">Nema korisnika.</div>
            ) : (
              users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                  <Link href={`/dashboard/korisnici/${user.id}`} className="shrink-0">
                    {user.avatarUrl ? (
                      <img
                        src={`${(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace('/api/v1', '')}${user.avatarUrl}`}
                        alt={user.displayName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/dashboard/korisnici/${user.id}`} className="font-medium text-sm text-foreground hover:underline truncate">
                        {user.displayName}
                      </Link>
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[user.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {STATUS_LABELS[user.status] ?? user.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{user.email}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{ROLE_LABELS[user.role] ?? user.role}</div>
                  </div>
                  <ActionsMenu user={user} onToggle={handleToggleRequest} onDelete={handleDeleteRequest} />
                </div>
              ))
            )}
          </div>

          {/* Table view — desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Korisnik</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">E-mail</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefon</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grad</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uloga</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Porudžbine</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Akcije</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Nema korisnika.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4">
                        <Link href={`/dashboard/korisnici/${user.id}`} className="flex items-center gap-2.5 hover:underline">
                          {user.avatarUrl ? (
                            <img
                              src={`${(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace('/api/v1', '')}${user.avatarUrl}`}
                              alt={user.displayName}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-foreground truncate max-w-[140px]">{user.displayName}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground truncate max-w-[160px]">{user.email}</td>
                      <td className="px-4 py-4 text-muted-foreground">{user.phone ?? '—'}</td>
                      <td className="px-4 py-4 text-muted-foreground">{user.city ?? '—'}</td>
                      <td className="px-4 py-4">
                        <span className="text-xs font-medium text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[user.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {STATUS_LABELS[user.status] ?? user.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-muted-foreground">{user.ordersCount}</td>
                      <td className="px-4 py-4 text-center">
                        <ActionsMenu user={user} onToggle={handleToggleRequest} onDelete={handleDeleteRequest} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="px-4 py-4 border-t border-border flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                Stranica {meta.page} od {meta.totalPages} ({meta.total} ukupno)
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page === meta.totalPages}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create user modal */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { showToast('Korisnik je kreiran.'); void fetchUsers(); }}
        />
      )}

      {/* Confirmation modal */}
      {confirm && (
        <ConfirmModal
          title={confirm.label}
          onConfirm={() => void handleConfirmAction()}
          onCancel={() => setConfirm(null)}
          loading={actionLoading}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-4 bg-foreground text-background rounded-xl text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
