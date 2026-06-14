'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Settings, Check, Loader2, Send, CheckCircle2, XCircle, Eye, EyeOff, Save, Clock, Download, AlignLeft, Bell, Layers, ChevronRight } from 'lucide-react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import {
  getAdminSettings,
  updateAdminSettingsGroup,
  getAdminSettingsGroup,
  getSmtpSettings,
  updateSmtpSettings,
  testSmtpConnection,
  getImapSettings,
  updateImapSettings,
  getWorkingHours,
  updateWorkingHoursDay,
  exportEmails,
  exportNewsletter,
  getFooterSettings,
  updateFooterSettings,
  type PlatformSettingItem,
  type SettingsGrouped,
  type SmtpSettings,
  type ImapSettings,
  type WorkingHoursDay,
  type FooterSettings,
} from '../../../lib/api/client';

type DraftValues = Record<string, string>;

// Keys that should always render as a toggle switch regardless of API type
const FORCE_BOOLEAN_KEYS = new Set([
  'smtpSecure', 'smtp.secure', 'secure', 'useSSL', 'useTLS', 'ssl', 'tls',
  'imap.tls', 'imapTls',
]);

// Keys that should never be shown in the UI
const SKIP_KEYS = new Set([
  'imap.mailbox', 'imapMailbox',
]);

const LABEL_MAP: Record<string, string> = {
  // Dot-notation keys (actual API format observed in browser)
  'smtp.host': 'SMTP Host',
  'smtp.port': 'SMTP Port',
  'smtp.user': 'Korisničko ime',
  'smtp.password': 'Lozinka',
  'smtp.fromEmail': 'Email pošiljaoca',
  'smtp.fromName': 'Ime pošiljaoca',
  'smtp.secure': 'Koristi SSL/TLS (preporučeno)',
  // IMAP dot-notation keys
  'imap.host': 'IMAP Host',
  'imap.port': 'IMAP Port',
  'imap.user': 'Korisničko ime',
  'imap.password': 'Lozinka',
  'imap.tls': 'Koristi SSL/TLS (preporučeno)',
  // IMAP camelCase aliases
  imapHost: 'IMAP Host',
  imapPort: 'IMAP Port',
  imapUser: 'Korisničko ime',
  imapPassword: 'Lozinka',
  imapTls: 'Koristi SSL/TLS (preporučeno)',
  // camelCase aliases
  smtpHost: 'SMTP Host',
  smtpPort: 'SMTP Port',
  smtpUser: 'Korisničko ime',
  smtpPassword: 'Lozinka',
  smtpFrom: 'Email pošiljaoca',
  smtpFromName: 'Ime pošiljaoca',
  smtpSecure: 'Koristi SSL/TLS (preporučeno)',
  // aliases for alternate API key names
  host: 'SMTP Host',
  port: 'SMTP Port',
  username: 'Korisničko ime',
  password: 'Lozinka',
  fromEmail: 'Email pošiljaoca',
  fromName: 'Ime pošiljaoca',
  secure: 'Koristi SSL/TLS (preporučeno)',
  user: 'Korisničko ime',
  // General
  siteName: 'Naziv platforme',
  siteUrl: 'URL sajta',
  supportEmail: 'E-mail podrške',
  contactEmail: 'Kontakt e-mail',
  defaultCurrency: 'Podrazumevana valuta',
  defaultLanguage: 'Podrazumevani jezik',
  maintenanceMode: 'Režim održavanja',
  maintenanceMessage: 'Poruka za režim održavanja',
  enableDebugMode: 'Debug režim',
  adminNotificationEmail: 'Admin e-mail za obaveštenja',
  orderNotificationEmail: 'E-mail za obaveštenja o narudžbinama',
  enableOrderEmails: 'Slanje emailova za narudžbine',
  enableStockAlerts: 'Upozorenja o zalihi',
  lowStockThreshold: 'Prag niske zalihe',
  defaultDeliveryPrice: 'Podrazumevana cena dostave',
  freeDeliveryThreshold: 'Besplatna dostava od (RSD)',
  enableFreeDelivery: 'Besplatna dostava',
  enableBankTransfer: 'Uplata na račun',
  enableCashOnDelivery: 'Plaćanje pouzećem',
  enableCardPayment: 'Plaćanje karticom',
  enableRegistration: 'Dozvoli registraciju',
  requireEmailVerification: 'Zahtevaj potvrdu e-mail adrese',
  defaultMetaTitle: 'Podrazumevani meta naslov',
  defaultMetaDescription: 'Podrazumevani meta opis',
  enableOpenGraph: 'Open Graph',
  uploadBaseUrl: 'Upload base URL',
  storagePath: 'Putanja storage foldera',
};

const GROUP_LABELS: Record<string, string> = {
  general: 'Opšta podešavanja',
  smtp: 'SMTP Podešavanja',
  imap: 'IMAP Podešavanja',
  email: 'E-mail podešavanja',
  orders: 'Narudžbine',
  delivery: 'Dostava',
  payments: 'Plaćanje',
  notifications: 'Obaveštenja',
  seo: 'SEO',
  system: 'Sistem',
  users: 'Korisnici',
};

// ─── SMTP Section ─────────────────────────────────────────────────────────────
function SmtpSection() {
  const EMPTY: SmtpSettings = { host: '', port: 465, user: '', password: '', fromEmail: '', fromName: '', secure: true };
  const [draft, setDraft] = useState<SmtpSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [err, setErr] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getSmtpSettings()
      .then((data) => setDraft({
        host: data.host ?? '',
        port: data.port ?? 465,
        user: data.user ?? '',
        fromEmail: data.fromEmail ?? '',
        fromName: data.fromName ?? '',
        secure: data.secure ?? true,
        password: '',
      }))
      .catch(() => setErr('Nije moguće učitati SMTP podešavanja.'))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof SmtpSettings>(key: K, val: SmtpSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      const payload: SmtpSettings = { ...draft };
      if (!payload.password) delete payload.password;
      await updateSmtpSettings(payload);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Greška pri čuvanju.');
    } finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true); setTestResult(null);
    try {
      const res = await testSmtpConnection();
      setTestResult({ ok: res.success, msg: res.message ?? (res.success ? 'Konekcija uspešna' : 'Konekcija neuspešna') });
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Greška pri testiranju' });
    } finally { setTesting(false); }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-muted/20">
        <h2 className="text-sm font-semibold text-foreground">SMTP Podešavanja</h2>
      </div>
      {err && <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{err}</div>}
      {loading ? (
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-11 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (
        <>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Email pošiljaoca</p>
              <input value={draft.fromEmail} onChange={(e) => set('fromEmail', e.target.value)} className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Ime pošiljaoca</p>
              <input value={draft.fromName} onChange={(e) => set('fromName', e.target.value)} className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">SMTP Host</p>
              <input value={draft.host} onChange={(e) => set('host', e.target.value)} className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Lozinka</p>
              <input type="password" value={draft.password ?? ''} onChange={(e) => set('password', e.target.value)} placeholder="Unesite novu lozinku (prazno = bez promene)" className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">SMTP Port</p>
              <input type="number" value={draft.port} onChange={(e) => set('port', Number(e.target.value))} className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Korisničko ime</p>
              <input value={draft.user} onChange={(e) => set('user', e.target.value)} className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>
          <div className="px-6 pb-2 border-t border-border flex items-center justify-between pt-4">
            <span className="text-sm text-foreground">Koristi SSL/TLS (preporučeno)</span>
            <Toggle checked={draft.secure} onChange={(v) => set('secure', v)} />
          </div>
          <div className="px-6 py-4 border-t border-border flex items-center gap-3">
            <button onClick={handleTest} disabled={testing} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors disabled:opacity-60">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Test SMTP konekcije
            </button>
            {testResult && (
              <span className={`flex items-center gap-1.5 text-xs font-medium ${testResult.ok ? 'text-green-600' : 'text-destructive'}`}>
                {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {testResult.msg}
              </span>
            )}
          </div>
          <div className="px-6 pb-6 flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Sačuvaj SMTP podešavanja
            </button>
            {saved && <span className="flex items-center gap-1.5 text-xs font-medium text-green-600"><Check className="h-3.5 w-3.5" /> Sačuvano</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── IMAP Section ─────────────────────────────────────────────────────────────
function ImapSection() {
  const EMPTY: ImapSettings = { host: '', port: 993, user: '', password: '', tls: true };
  const [draft, setDraft] = useState<ImapSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getImapSettings()
      .then((data) => setDraft({
        host: data.host ?? '',
        port: data.port ?? 993,
        user: data.user ?? '',
        tls: data.tls ?? true,
        password: '',
      }))
      .catch(() => setErr('Nije moguće učitati IMAP podešavanja.'))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof ImapSettings>(key: K, val: ImapSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      const payload: ImapSettings = { ...draft };
      if (!payload.password) delete payload.password;
      await updateImapSettings(payload);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Greška pri čuvanju.');
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-muted/20">
        <h2 className="text-sm font-semibold text-foreground">IMAP Podešavanja</h2>
      </div>
      {err && <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{err}</div>}
      {loading ? (
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-11 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (
        <>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">IMAP Host</p>
              <input value={draft.host} onChange={(e) => set('host', e.target.value)} className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Lozinka</p>
              <input type="password" value={draft.password ?? ''} onChange={(e) => set('password', e.target.value)} placeholder="Unesite novu lozinku (prazno = bez promene)" className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">IMAP Port</p>
              <input type="number" value={draft.port} onChange={(e) => set('port', Number(e.target.value))} className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Korisničko ime</p>
              <input value={draft.user} onChange={(e) => set('user', e.target.value)} className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>
          <div className="px-6 pb-2 border-t border-border flex items-center justify-between pt-4">
            <span className="text-sm text-foreground">Koristi SSL/TLS (preporučeno)</span>
            <Toggle checked={draft.tls} onChange={(v) => set('tls', v)} />
          </div>
          <div className="px-6 py-6 border-t border-border flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Sačuvaj IMAP podešavanja
            </button>
            {saved && <span className="flex items-center gap-1.5 text-xs font-medium text-green-600"><Check className="h-3.5 w-3.5" /> Sačuvano</span>}
          </div>
        </>
      )}
    </div>
  );
}

function WorkingHoursSection() {
  const [hours, setHours] = useState<WorkingHoursDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [whError, setWhError] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getWorkingHours()
      .then((data) => {
        // API returns { dayOfWeek: 1-7, dayName: "Ponedeljak", isOpen: 0|1, openTime, closeTime }
        const rows = [...data].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((x) => ({
          dayOfWeek: x.dayOfWeek,
          dayName: x.dayName,
          isOpen: Boolean(x.isOpen),
          openTime: x.openTime ?? '09:00',
          closeTime: x.closeTime ?? '17:00',
        }));
        setHours(rows);
      })
      .catch(() => setWhError('Nije moguće učitati radno vreme.'))
      .finally(() => setLoading(false));
  }, []);

  function update(dayOfWeek: number, patch: Partial<WorkingHoursDay>) {
    setHours((prev) => prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h)));
  }

  async function handleSave() {
    setSaving(true);
    setWhError('');
    try {
      await Promise.all(
        hours.map((h) =>
          updateWorkingHoursDay(h.dayOfWeek, { isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime }),
        ),
      );
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setWhError(e instanceof Error ? e.message : 'Nije moguće sačuvati radno vreme.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Radno vreme</h2>
      </div>

      {whError && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{whError}</div>
      )}

      {loading ? (
        <div className="p-6 space-y-3">
          {[...Array(7)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {hours.map((h) => (
            <div key={h.dayOfWeek} className="grid grid-cols-2 sm:grid-cols-[140px_auto_1fr] items-center gap-x-4 sm:gap-x-6 gap-y-2 px-4 sm:px-6 py-3 sm:py-3.5">
              {/* Day name */}
              <span className="col-span-2 sm:col-span-1 text-sm font-medium text-foreground order-1">{h.dayName}</span>

              {/* Toggle + status */}
              <div className="col-span-2 sm:col-span-1 flex items-center gap-3 order-3 sm:order-2">
                <Toggle checked={h.isOpen} onChange={(v) => update(h.dayOfWeek, { isOpen: v })} />
                <span className={`text-xs font-medium w-16 ${h.isOpen ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {h.isOpen ? 'Otvoreno' : 'Zatvoreno'}
                </span>
              </div>

              {/* Time range */}
              <div className="col-span-2 sm:col-span-1 flex items-center gap-2 order-2 sm:order-3">
                <input
                  type="time"
                  value={h.openTime ?? ''}
                  disabled={!h.isOpen}
                  onChange={(e) => update(h.dayOfWeek, { openTime: e.target.value })}
                  className="flex-1 sm:w-32 sm:flex-none px-3 py-2 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-35 disabled:cursor-not-allowed"
                />
                <span className="text-muted-foreground text-sm">—</span>
                <input
                  type="time"
                  value={h.closeTime ?? ''}
                  disabled={!h.isOpen}
                  onChange={(e) => update(h.dayOfWeek, { closeTime: e.target.value })}
                  className="flex-1 sm:w-32 sm:flex-none px-3 py-2 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-35 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-6 py-4 border-t border-border flex items-center justify-start gap-3">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Sačuvaj radno vreme
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
            <Check className="h-3.5 w-3.5" /> Sačuvano
          </span>
        )}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-primary' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function SettingField({
  setting,
  value,
  onChange,
}: {
  setting: PlatformSettingItem;
  value: string;
  onChange: (key: string, val: string) => void;
}) {
  const [showPass, setShowPass] = useState(false);
  const label = LABEL_MAP[setting.key] ?? setting.key;
  const isPassword =
    setting.key.toLowerCase().includes('password') || setting.key.toLowerCase().includes('secret');
  const isMultiline =
    setting.key === 'maintenanceMessage' || setting.key === 'defaultMetaDescription';

  const isBoolean = setting.type === 'BOOLEAN' || FORCE_BOOLEAN_KEYS.has(setting.key);

  if (isBoolean) {
    return (
      <div className="flex items-center justify-between py-3.5 border-b border-border last:border-0">
        <div className="flex-1 min-w-0 pr-6">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {setting.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
          )}
        </div>
        <Toggle checked={value === 'true'} onChange={(v) => onChange(setting.key, v ? 'true' : 'false')} />
      </div>
    );
  }

  return (
    <div className={isMultiline ? 'sm:col-span-2' : ''}>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
        {label}
      </label>
      {isMultiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(setting.key, e.target.value)}
          rows={3}
          className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
        />
      ) : isPassword ? (
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(setting.key, e.target.value)}
            autoComplete="new-password"
            placeholder="Unesite novu lozinku (prazno = bez promene)"
            className="w-full px-4 py-3 pr-10 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={() => setShowPass((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <input
          type={setting.type === 'NUMBER' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(setting.key, e.target.value)}
          min={setting.type === 'NUMBER' ? 0 : undefined}
          className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      )}
    </div>
  );
}

function SettingsSection({
  groupKey,
  settings,
  draft,
  saving,
  saved,
  onDraftChange,
  onSave,
  smtpTestNode,
  saveLabel,
}: {
  groupKey: string;
  settings: PlatformSettingItem[];
  draft: DraftValues;
  saving: boolean;
  saved: boolean;
  onDraftChange: (key: string, val: string) => void;
  onSave: (group: string) => void;
  smtpTestNode?: React.ReactNode;
  saveLabel?: string;
}) {
  if (!settings?.length) return null;
  const title = GROUP_LABELS[groupKey] ?? groupKey;
  const visible = settings.filter((s) => !SKIP_KEYS.has(s.key));
  const inputFields = visible.filter((s) => s.type !== 'BOOLEAN' && !FORCE_BOOLEAN_KEYS.has(s.key));
  const boolFields = visible.filter((s) => s.type === 'BOOLEAN' || FORCE_BOOLEAN_KEYS.has(s.key));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-muted/20">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>

      {inputFields.length > 0 && (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {inputFields.map((s) => (
            <SettingField
              key={s.key}
              setting={s}
              value={draft[s.key] ?? s.value}
              onChange={onDraftChange}
            />
          ))}
        </div>
      )}

      {boolFields.length > 0 && (
        <div className={`px-6 ${inputFields.length > 0 ? 'border-t border-border' : 'pt-4'} pb-2`}>
          {boolFields.map((s) => (
            <SettingField
              key={s.key}
              setting={s}
              value={draft[s.key] ?? s.value}
              onChange={onDraftChange}
            />
          ))}
        </div>
      )}

      {smtpTestNode && (
        <div className="px-6 py-4 border-t border-border">{smtpTestNode}</div>
      )}
      <div className={`px-6 py-4 border-t border-border flex items-center gap-3 ${saveLabel ? 'justify-start' : 'justify-end'}`}>
        <button
          onClick={() => onSave(groupKey)}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveLabel ? <Save className="h-4 w-4" /> : null}
          {saveLabel ?? 'Sačuvaj'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
            <Check className="h-3.5 w-3.5" /> Sačuvano
          </span>
        )}
      </div>
    </div>
  );
}

export default function PodesavanjaPage() {
  const [grouped, setGrouped] = useState<SettingsGrouped>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftValues>({});
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [savedGroup, setSavedGroup] = useState<string | null>(null);
  const [error, setError] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminSettings();
      setGrouped(data);
      const initDraft: DraftValues = {};
      for (const group of Object.values(data)) {
        for (const s of group) {
          const k = s.key.toLowerCase();
          const isPassField = k.includes('password') || k.includes('secret');
          // Password fields: start empty so the user knows to type a new value to change it.
          // The server never sends the real password in plaintext.
          initDraft[s.key] = isPassField ? '' : String(s.value ?? '');
        }
      }
      setDraft(initDraft);
    } catch {
      setError('Nije moguće učitati podešavanja.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleDraftChange(key: string, val: string) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave(group: string) {
    const sectionSettings = grouped[group] ?? [];
    const prefix = `${group}.`;
    const val = (s: PlatformSettingItem) => draft[s.key] ?? s.value;
    const bareKey = (key: string) => key.startsWith(prefix) ? key.slice(prefix.length) : key;

    setSavingGroup(group);
    setError('');
    try {
      const payload = sectionSettings.map((s) => ({
        key: bareKey(s.key),
        value: val(s),
      }));
      const updated = await updateAdminSettingsGroup(group, payload);
      setGrouped((prev) => ({ ...prev, [group]: updated }));
      setSavedGroup(group);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSavedGroup(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Nije moguće sačuvati podešavanja.');
    } finally {
      setSavingGroup(null);
    }
  }

  // smtp and imap are handled by dedicated SmtpSection / ImapSection components
  const groupKeys = Object.keys(grouped).filter(
    (k) => k !== 'footer' && k !== 'general' && k !== 'notifications' && k !== 'smtp' && k !== 'imap' && k !== 'email',
  );

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Podešavanja
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Upravljajte podešavanjima sistema</p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            href="/dashboard/podesavanja/slider"
            className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3.5 hover:border-primary/50 hover:bg-muted/30 transition-colors group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Slider</p>
              <p className="text-xs text-muted-foreground">Hero sekcija sajta</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-56 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : null}

        {groupKeys.length > 0 && (
          <div className="space-y-4">
            {groupKeys.map((groupKey) => (
              <SettingsSection
                key={groupKey}
                groupKey={groupKey}
                settings={grouped[groupKey]}
                draft={draft}
                saving={savingGroup === groupKey}
                saved={savedGroup === groupKey}
                onDraftChange={handleDraftChange}
                onSave={handleSave}
              />
            ))}
          </div>
        )}

        <ImapSection />
        <SmtpSection />
        <NotificationsSection />
        <WorkingHoursSection />
        <FooterSection />
        <ExportEmailSection />
        <ExportNewsletterSection />
      </div>
    </DashboardLayout>
  );
}

function FooterSection() {
  const EMPTY: FooterSettings = {
    description: '', facebookUrl: '', instagramUrl: '',
    twitterUrl: '', tiktokUrl: '', street: '', city: '',
    phone: '', email: '', pib: '', mb: '',
  };
  const [draft, setDraft] = useState<FooterSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [footerError, setFooterError] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getFooterSettings()
      .then((data) => setDraft({ ...EMPTY, ...data }))
      .catch(() => setFooterError('Nije moguće učitati footer podešavanja.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(key: keyof FooterSettings, val: string) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    setFooterError('');
    try {
      await updateFooterSettings(draft);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch {
      setFooterError('Nije moguće sačuvati footer podešavanja.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/40';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1.5';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
          <AlignLeft className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Footer Podešavanja</h2>
          <p className="text-xs text-muted-foreground">Podešavanje informacija u footer-u sajta</p>
        </div>
      </div>

      {footerError && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{footerError}</div>
      )}

      {loading ? (
        <div className="p-6 space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Opis */}
          <div>
            <label className={labelCls}>Opis ispod logoa</label>
            <textarea
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          {/* Društvene mreže */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Društvene mreže (Pratite nas)</p>
            <p className="text-xs text-muted-foreground mb-3">Ostavite prazno ako ne želite da se prikaže ikonica</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Facebook link</label>
                <input type="url" value={draft.facebookUrl} onChange={(e) => set('facebookUrl', e.target.value)} placeholder="https://facebook.com/..." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Instagram link</label>
                <input type="url" value={draft.instagramUrl} onChange={(e) => set('instagramUrl', e.target.value)} placeholder="https://www.instagram.com/..." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>X (Twitter) link</label>
                <input type="url" value={draft.twitterUrl} onChange={(e) => set('twitterUrl', e.target.value)} placeholder="https://x.com/..." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>TikTok link</label>
                <input type="url" value={draft.tiktokUrl} onChange={(e) => set('tiktokUrl', e.target.value)} placeholder="https://tiktok.com/@..." className={inputCls} />
              </div>
            </div>
          </div>

          {/* Kontakt */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Kontakt informacije</p>
            <p className="text-xs text-muted-foreground mb-3">Ostavite prazno ukoliko ne želite da se prikaže u footer-u</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Ulica</label>
                <input type="text" value={draft.street} onChange={(e) => set('street', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Grad</label>
                <input type="text" value={draft.city} onChange={(e) => set('city', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Broj telefona</label>
                <input type="tel" value={draft.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email adresa</label>
                <input type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>PIB</label>
                <input type="text" value={draft.pib} onChange={(e) => set('pib', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Matični broj (MB)</label>
                <input type="text" value={draft.mb} onChange={(e) => set('mb', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-4 border-t border-border flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Sačuvaj Footer podešavanja
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
            <Check className="h-3.5 w-3.5" /> Sačuvano
          </span>
        )}
      </div>
    </div>
  );
}

function NotificationsSection() {
  const [contactEmail, setContactEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAdminSettingsGroup('notifications')
      .then((items: PlatformSettingItem[]) => {
        const found = items.find((i) => i.key === 'notifications.contactEmail' || i.key === 'contactEmail');
        setContactEmail(String(found?.value ?? ''));
      })
      .catch(() => setErr('Nije moguće učitati podešavanja obaveštenja.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setErr('');
    try {
      await updateAdminSettingsGroup('notifications', [
        { key: 'contactEmail', value: contactEmail },
      ]);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Greška pri čuvanju.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Bell className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Notifikacije</h2>
          <p className="text-xs text-muted-foreground">Email adrese na koje stižu obaveštenja sa sajta</p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {loading ? (
          <div className="h-10 bg-muted rounded-xl animate-pulse" />
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Email za poruke sa kontakt forme
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="npr. kontakt@firma.rs"
                className={inputCls}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ako je prazno, poruke idu na SMTP korisničku adresu.
              </p>
            </div>

            {err && <p className="text-xs text-destructive">{err}</p>}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sačuvaj
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                  <Check className="h-3.5 w-3.5" /> Sačuvano
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ExportEmailSection() {
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [exportError, setExportError] = useState('');

  async function handleExport(format: 'csv' | 'excel') {
    const setLoading = format === 'csv' ? setLoadingCsv : setLoadingExcel;
    setLoading(true);
    setExportError('');
    try {
      await exportEmails(format);
    } catch {
      setExportError('Nije moguće preuzeti fajl. Pokušajte ponovo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
          <Download className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Export Email Adresa</h2>
          <p className="text-xs text-muted-foreground">Preuzmite listu email adresa svih kupaca iz porudžbina</p>
        </div>
      </div>

      <div className="px-6 py-5 flex items-center gap-3">
        <button
          onClick={() => handleExport('csv')}
          disabled={loadingCsv || loadingExcel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {loadingCsv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Preuzmi CSV
        </button>
        <button
          onClick={() => handleExport('excel')}
          disabled={loadingCsv || loadingExcel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary text-primary text-sm font-medium hover:bg-primary/5 disabled:opacity-60 transition-colors"
        >
          {loadingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Preuzmi Excel
        </button>
        {exportError && (
          <span className="text-xs text-destructive">{exportError}</span>
        )}
      </div>
    </div>
  );
}

function ExportNewsletterSection() {
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [exportError, setExportError] = useState('');

  async function handleExport(format: 'csv' | 'excel') {
    const setLoading = format === 'csv' ? setLoadingCsv : setLoadingExcel;
    setLoading(true);
    setExportError('');
    try {
      await exportNewsletter(format);
    } catch {
      setExportError('Nije moguće preuzeti fajl. Pokušajte ponovo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
          <Download className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Export Newsletter Pretplatnika</h2>
          <p className="text-xs text-muted-foreground">Preuzmite listu email adresa korisnika koji su se pretplatili na newsletter</p>
        </div>
      </div>

      <div className="px-6 py-5 flex items-center gap-3">
        <button
          onClick={() => handleExport('csv')}
          disabled={loadingCsv || loadingExcel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {loadingCsv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Preuzmi CSV
        </button>
        <button
          onClick={() => handleExport('excel')}
          disabled={loadingCsv || loadingExcel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary text-primary text-sm font-medium hover:bg-primary/5 disabled:opacity-60 transition-colors"
        >
          {loadingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Preuzmi Excel
        </button>
        {exportError && (
          <span className="text-xs text-destructive">{exportError}</span>
        )}
      </div>
    </div>
  );
}
