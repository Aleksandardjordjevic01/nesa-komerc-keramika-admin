'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '../../../../components/layout/dashboard-layout';
import {
  getAdminUser,
  getAdminUserOrders,
  updateAdminUser,
  updateAdminUserStatus,
  updateAdminUserRole,
  deleteAdminUser,
  resetAdminUserPassword,
  sendAdminUserResetEmail,
  type AdminUserDetail,
  type AdminUserRecentOrder,
  type UserStatus,
  type UserRole,
} from '../../../../lib/api/client';
import {
  ArrowLeft,
  Key,
  Send,
  Eye,
  EyeOff,
  ShoppingBag,
  Calendar,
  ShieldCheck,
  Ban,
  Trash2,
  Pencil,
  X,
  Check,
} from 'lucide-react';

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

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Na čekanju',
  processing: 'U obradi',
  shipped: 'Poslato',
  delivered: 'Dostavljeno',
  cancelled: 'Otkazano',
  completed: 'Završeno',
};

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('sr-Latn-RS', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
// ConfirmModal replaced by inline render below

// ── Edit Field ────────────────────────────────────────────────────────────────
function EditableField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    await onSave(input);
    setLoading(false);
    setEditing(false);
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button onClick={() => void save()} disabled={loading} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setInput(value); setEditing(false); }} className="p-1.5 rounded-lg border border-border hover:bg-muted">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 group">
          <span className="text-sm text-foreground">{value || '—'}</span>
          <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
            <Pencil className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function KorisnikDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [orders, setOrders] = useState<AdminUserRecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [confirm, setConfirm] = useState<{
    status: UserStatus;
    title: string;
    subtitle: string;
    description: string;
    confirmLabel: string;
    destructive: boolean;
  } | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<UserRole | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Password section
  const [pwExpanded, setPwExpanded] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function load() {
    setLoading(true);
    try {
      const [data, userOrders] = await Promise.all([
        getAdminUser(id),
        getAdminUserOrders(id),
      ]);
      setUser(data);
      setOrders(userOrders);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Greška pri učitavanju.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function handleSaveField(field: string, value: string) {
    try {
      await updateAdminUser(id, { [field]: value });
      showToast('Korisnik je ažuriran.');
      void load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Greška.');
    }
  }

  async function handleConfirmStatus() {
    if (!confirm) return;
    setActionLoading(true);
    try {
      await updateAdminUserStatus(id, confirm.status);
      showToast('Status korisnika je promenjen.');
      setConfirm(null);
      void load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Greška.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteUser() {
    setActionLoading(true);
    try {
      await deleteAdminUser(id);
      setDeleteConfirm(false);
      router.push('/dashboard/korisnici');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Greška pri brisanju.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRoleChange() {
    if (!roleConfirm) return;
    setActionLoading(true);
    try {
      await updateAdminUserRole(id, roleConfirm);
      showToast('Uloga korisnika je promenjena.');
      setRoleConfirm(null);
      void load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Greška.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-48" />
            <div className="h-32 bg-muted rounded-xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !user) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <p className="text-destructive text-sm">{error || 'Korisnik nije pronađen.'}</p>
          <Link href="/dashboard/korisnici" className="text-sm text-primary mt-2 inline-block hover:underline">← Nazad</Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Back */}
        <Link href="/dashboard/korisnici" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Korisnici
        </Link>

        {/* Profile header */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6 card-shadow space-y-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {user.avatarUrl ? (
              <img
                src={`${(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace('/api/v1', '')}${user.avatarUrl}`}
                alt={user.displayName}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary flex-shrink-0">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Name + badges */}
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-foreground">{user.displayName}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[user.status] ?? 'bg-muted text-muted-foreground'}`}>
                  {STATUS_LABELS[user.status] ?? user.status}
                </span>
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </div>
            </div>
          </div>
          {/* Status actions — below avatar row on all sizes */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
            {user.status === 'INACTIVE' && (
              <button
                onClick={() => setConfirm({ status: 'ACTIVE', title: 'Da li sigurno želiš da', subtitle: 'aktiviraš korisnika?', description: `Korisnik ${user.displayName} ponovo će dobiti pun pristup nalogu.`, confirmLabel: 'Da, aktiviraj', destructive: false })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Aktiviraj
              </button>
            )}
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/40 text-sm text-destructive hover:bg-destructive/5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Obriši korisnika
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: profile info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact info */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 card-shadow space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Informacije o nalogu</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditableField label="Ime" value={user.firstName ?? ''} onSave={(v) => handleSaveField('firstName', v)} />
                <EditableField label="Prezime" value={user.lastName ?? ''} onSave={(v) => handleSaveField('lastName', v)} />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">E-mail</p>
                  <p className="text-sm text-foreground">{user.email}</p>
                </div>
                <EditableField label="Telefon" value={user.phone ?? ''} onSave={(v) => handleSaveField('phone', v)} />
                <EditableField label="Grad" value={user.city ?? ''} onSave={(v) => handleSaveField('city', v)} />
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Adresa za isporuku</p>
                <p className="text-sm text-muted-foreground">Nema sačuvane adrese za isporuku.</p>
              </div>
            </div>

            {/* Recent orders */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 card-shadow">
              <h2 className="text-sm font-semibold text-foreground mb-4">Porudžbine</h2>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nema porudžbina.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {orders.map((o) => (
                    <li key={o.id} className="py-3 flex items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <ShoppingBag className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-foreground">{o.orderNumber}</span>
                          <div className="flex items-center gap-2 mt-0.5 sm:hidden">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {ORDER_STATUS_LABELS[o.status] ?? o.status}
                            </span>
                            <span className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-medium text-foreground">{o.total.toLocaleString('sr-RS')} RSD</span>
                        <span className="hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {ORDER_STATUS_LABELS[o.status] ?? o.status}
                        </span>
                        <span className="hidden sm:inline text-xs text-muted-foreground">{formatDate(o.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right: stats + metadata */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 card-shadow space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Statistike</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 rounded-lg px-3 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Porudžbine</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{user.stats.ordersCount}</p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Reklamacije</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{user.stats.reklamacijeCount}</p>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 card-shadow space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Datumi</h2>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Registrovan:</span>
                  <span className="text-foreground">{formatDate(user.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Role management */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 card-shadow space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Uloga</h2>
              <div className="space-y-2">
                {(['USER', 'ADMIN'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => { if (role !== user.role) setRoleConfirm(role); }}
                    disabled={role === user.role}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      user.role === role
                        ? 'border-primary bg-primary/10 text-primary font-medium cursor-default'
                        : 'border-border text-foreground hover:bg-muted hover:border-primary/40'
                    }`}
                  >
                    {ROLE_LABELS[role]}
                    {user.role === role && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Klik na ulogu otvara potvrdu pre promene.</p>
            </div>

            {/* Password management */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 card-shadow space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Lozinka</h2>

              {/* Send reset email */}
              <button
                onClick={async () => {
                  setEmailLoading(true);
                  try {
                    const res = await sendAdminUserResetEmail(id);
                    showToast('Link za resetovanje je kreiran.');
                    if (res.resetLink) {
                      navigator.clipboard.writeText(res.resetLink).catch(() => null);
                      showToast('Reset link kopiran u clipboard.');
                    }
                  } catch (e: unknown) {
                    showToast(e instanceof Error ? e.message : 'Greška.');
                  } finally {
                    setEmailLoading(false);
                  }
                }}
                disabled={emailLoading}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-60"
              >
                <Send className="w-4 h-4 text-muted-foreground" />
                {emailLoading ? 'Kreiranje...' : 'Pošalji link za resetovanje lozinke'}
              </button>

              {/* Set new password directly */}
              {!pwExpanded ? (
                <button
                  onClick={() => setPwExpanded(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Key className="w-4 h-4 text-muted-foreground" />
                  Postavi novu lozinku ručno
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Nova lozinka (min. 8 znakova)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pr-10 pl-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setPwExpanded(false); setNewPassword(''); setShowPassword(false); }}
                      className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      Odustani
                    </button>
                    <button
                      onClick={async () => {
                        if (newPassword.length < 8) { showToast('Lozinka mora imati najmanje 8 znakova.'); return; }
                        setPwLoading(true);
                        try {
                          await resetAdminUserPassword(id, newPassword);
                          showToast('Lozinka je uspešno promenjena.');
                          setPwExpanded(false);
                          setNewPassword('');
                          setShowPassword(false);
                        } catch (e: unknown) {
                          showToast(e instanceof Error ? e.message : 'Greška.');
                        } finally {
                          setPwLoading(false);
                        }
                      }}
                      disabled={pwLoading || newPassword.length < 8}
                      className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
                    >
                      {pwLoading ? 'Čuvanje...' : 'Sačuvaj'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-10 w-full max-w-md shadow-xl text-center">
            <div className="flex items-center justify-center rounded-full bg-destructive/10 mx-auto mb-6" style={{ width: 72, height: 72 }}>
              <Trash2 className="w-9 h-9 text-destructive" />
            </div>
            <h3 className="text-lg font-bold text-foreground leading-snug mb-1">Da li sigurno želiš da</h3>
            <h3 className="text-lg font-bold text-destructive leading-snug mb-4">obrišeš korisnika?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              Korisnik <span className="font-semibold text-foreground">{user.displayName}</span> će biti trajno obrisan. Ova akcija je nepovratna.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-foreground border border-border hover:bg-muted transition-colors"
              >
                Ne, zadrži
              </button>
              <button
                onClick={() => void handleDeleteUser()}
                disabled={actionLoading}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60 transition-colors"
              >
                {actionLoading ? 'Čekajte...' : 'Da, obriši'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role confirm modal */}
      {roleConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-10 w-full max-w-md shadow-xl text-center">
            {/* Icon */}
            <div className="flex items-center justify-center w-18 h-18 rounded-full bg-primary/10 mx-auto mb-6" style={{ width: 72, height: 72 }}>
              <ShieldCheck className="w-9 h-9 text-primary" />
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-foreground leading-snug mb-1">
              Da li sigurno želiš da
            </h3>
            <h3 className="text-lg font-bold text-primary leading-snug mb-4">
              promeniš ulogu?
            </h3>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              Korisnik <span className="font-semibold text-foreground">{user?.displayName}</span> dobiće ulogu{' '}
              <span className="font-semibold text-foreground">{ROLE_LABELS[roleConfirm]}</span>.
              Ova akcija menja pristup korisnika sistemu.
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setRoleConfirm(null)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-foreground border border-border hover:bg-muted transition-colors"
              >
                Ne, zadrži
              </button>
              <button
                onClick={() => void handleRoleChange()}
                disabled={actionLoading}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {actionLoading ? 'Čekajte...' : 'Da, promeni'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-10 w-full max-w-md shadow-xl text-center">
            <div
              className={`flex items-center justify-center rounded-full mx-auto mb-6 ${
                confirm.destructive ? 'bg-destructive/10' : 'bg-primary/10'
              }`}
              style={{ width: 72, height: 72 }}
            >
              {confirm.destructive
                ? <Ban className="w-9 h-9 text-destructive" />
                : <ShieldCheck className="w-9 h-9 text-primary" />}
            </div>
            <h3 className="text-lg font-bold text-foreground leading-snug mb-1">{confirm.title}</h3>
            <h3 className={`text-lg font-bold leading-snug mb-4 ${
              confirm.destructive ? 'text-destructive' : 'text-primary'
            }`}>{confirm.subtitle}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">{confirm.description}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-foreground border border-border hover:bg-muted transition-colors"
              >
                Ne, zadrži
              </button>
              <button
                onClick={() => void handleConfirmStatus()}
                disabled={actionLoading}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors ${
                  confirm.destructive
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {actionLoading ? 'Čekajte...' : confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-foreground text-background rounded-xl text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
