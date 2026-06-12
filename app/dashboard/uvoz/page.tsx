'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import {
  Upload,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  Play,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  Settings,
  FileText,
  Globe,
} from 'lucide-react';
import { CheckboxDropdown } from '../../../components/shared/checkbox-dropdown';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  runCsvImport,
  runApiImport,
  getMinottiB2BCatalogStructure,
  runMinottiB2BImport,
  type SupplierConfig,
  type ImportResult,
  type MinottiCatalogStructure,
  type MinottiB2BImportOptions,
} from '../../../lib/api/client';

// ── Supplier modal ────────────────────────────────────────────────────────────

const EMPTY_SUPPLIER: Omit<SupplierConfig, 'id' | 'createdAt'> = {
  name: '',
  type: 'CSV',
  url: '',
  apiUrl: '',
  encoding: 'utf-8',
  delimiter: ',',
  columnMapping: {
    sku: 'SKU',
    name: 'Naziv',
    price: 'Cena',
    stock: 'Zaliha',
    categoryName: 'Kategorija',
    description: 'Opis',
  },
  headers: {},
  apiHeaders: {},
  isActive: true,
};

function normalizeImportType(supplier?: SupplierConfig | null): 'CSV' | 'API' {
  if (!supplier) return 'CSV';
  const type = String(supplier.type ?? '').toUpperCase();
  return type === 'CSV' && !supplier.apiUrl ? 'CSV' : 'API';
}

function parseHeaders(headers?: SupplierConfig['headers'] | SupplierConfig['apiHeaders']): Record<string, string> {
  if (!headers) return {};
  if (typeof headers !== 'string') return headers;

  try {
    const parsed = JSON.parse(headers) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value ?? '')]),
    );
  } catch {
    return {};
  }
}

function serializeHeaders(headers: Record<string, string>): string {
  return JSON.stringify(headers);
}

function SupplierModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: SupplierConfig | null;
  onSave: (s: SupplierConfig) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<SupplierConfig, 'id' | 'createdAt'>>(
    initial
      ? {
          name: initial.name,
          type: normalizeImportType(initial),
          url: initial.url ?? initial.apiUrl ?? '',
          apiUrl: initial.apiUrl ?? initial.url ?? '',
          encoding: initial.encoding ?? 'utf-8',
          delimiter: initial.delimiter ?? ',',
          columnMapping: initial.columnMapping ?? EMPTY_SUPPLIER.columnMapping,
          headers: parseHeaders(initial.headers ?? initial.apiHeaders),
          apiHeaders: parseHeaders(initial.apiHeaders ?? initial.headers),
          isActive: initial.isActive,
        }
      : { ...EMPTY_SUPPLIER, columnMapping: { ...EMPTY_SUPPLIER.columnMapping } },
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const mappingEntries = Object.entries(form.columnMapping ?? {});

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function setMapping(field: string, col: string) {
    setForm((p) => ({ ...p, columnMapping: { ...(p.columnMapping ?? {}), [field]: col } }));
  }

  function setApiUrl(value: string) {
    setForm((p) => ({ ...p, url: value, apiUrl: value }));
  }

  function setHeader(key: string, value: string) {
    setForm((p) => ({
      ...p,
      headers: { ...parseHeaders(p.headers), [key]: value },
      apiHeaders: { ...parseHeaders(p.apiHeaders), [key]: value },
    }));
  }

  function buildSupplierPayload(): Omit<SupplierConfig, 'id' | 'createdAt'> {
    if (form.type === 'API') {
      const apiUrl = (form.apiUrl ?? form.url ?? '').trim();
      const apiKey = (parseHeaders(form.apiHeaders)['X-API-Key'] ?? parseHeaders(form.headers)['X-API-Key'] ?? '').trim();

      return {
        name: form.name.trim(),
        type: 'API',
        url: apiUrl,
        apiUrl,
        headers: serializeHeaders(apiKey ? { 'X-API-Key': apiKey } : {}),
        apiHeaders: serializeHeaders(apiKey ? { 'X-API-Key': apiKey } : {}),
        isActive: form.isActive,
      };
    }

    return {
      ...form,
      name: form.name.trim(),
      type: 'CSV',
    };
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr('Naziv je obavezan.'); return; }
    setSaving(true); setErr('');
    try {
      let result: SupplierConfig;
      const payload = buildSupplierPayload();
      if (initial) {
        result = await updateSupplier(initial.id, payload);
      } else {
        result = await createSupplier(payload);
      }
      onSave({
        ...(initial ?? {}),
        ...result,
        type: payload.type,
        url: result.url ?? result.apiUrl ?? payload.url ?? payload.apiUrl,
        apiUrl: result.apiUrl ?? payload.apiUrl ?? initial?.apiUrl,
        apiHeaders: result.apiHeaders ?? payload.apiHeaders,
        headers: result.headers ?? payload.headers,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Greška pri čuvanju.');
    } finally {
      setSaving(false);
    }
  }

  const apiKey = (parseHeaders(form.apiHeaders)['X-API-Key'] ?? parseHeaders(form.headers)['X-API-Key'] ?? '');

  const FIELD_LABELS: Record<string, string> = {
    sku: 'SKU',
    name: 'Naziv',
    price: 'Cena',
    stock: 'Zaliha',
    categoryName: 'Kategorija',
    description: 'Opis',
    brand: 'Brend',
    imageUrl: 'Slika URL',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">{initial ? 'Izmeni dobavljača' : 'Novi dobavljač'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-5 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{err}</div>}

          {/* Name */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Naziv dobavljača</p>
            <input
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="npr. Dobavljač d.o.o."
              className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Type */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Tip uvoza</p>
            <div className="grid grid-cols-2 gap-2">
              {(['CSV', 'API'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setField('type', t)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    form.type === t
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {t === 'CSV' ? <FileText className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* URL (for API type) */}
          {form.type === 'API' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">API URL</p>
                <input
                  value={form.apiUrl ?? form.url ?? ''}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.dobavljac.rs/products"
                  className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">X-API-Key</p>
                <input
                  value={apiKey}
                  onChange={(e) => setHeader('X-API-Key', e.target.value)}
                  placeholder="Unesite API ključ"
                  className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          )}

          {/* CSV options */}
          {form.type === 'CSV' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Encoding</p>
                <input
                  value={form.encoding ?? 'utf-8'}
                  onChange={(e) => setField('encoding', e.target.value)}
                  placeholder="utf-8"
                  className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Delimiter</p>
                <input
                  value={form.delimiter ?? ','}
                  onChange={(e) => setField('delimiter', e.target.value)}
                  placeholder=","
                  className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          )}

          {form.type === 'CSV' && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Mapiranje kolona</p>
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-2 px-3 py-2 bg-muted/30 text-xs font-medium text-muted-foreground border-b border-border">
                  <span>Polje sistema</span>
                  <span>Kolona u fajlu</span>
                </div>
                {mappingEntries.map(([field, col]) => (
                  <div key={field} className="grid grid-cols-2 items-center px-3 py-2 border-b border-border last:border-0 gap-2">
                    <span className="text-sm text-foreground">{FIELD_LABELS[field] ?? field}</span>
                    <input
                      value={col}
                      onChange={(e) => setMapping(field, e.target.value)}
                      className="text-sm px-2 py-1.5 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-foreground">Aktivan</span>
            <button
              onClick={() => setField('isActive', !form.isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-sm border border-border rounded-xl hover:bg-muted transition-colors font-medium"
          >
            Odustani
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors font-medium flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Sačuvaj
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import result panel ───────────────────────────────────────────────────────

function ResultPanel({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  const hasErrors = result.errors.length > 0;
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
          {hasErrors ? <AlertCircle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
          Rezultat uvoza
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{result.created}</p>
          <p className="text-xs text-green-600 mt-0.5">Kreirana</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
          <p className="text-xs text-blue-600 mt-0.5">Ažurirana</p>
        </div>
        <div className="bg-muted border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Preskočena</p>
        </div>
      </div>
      {hasErrors && (
        <div className="px-4 pb-4">
          <p className="text-xs font-medium text-destructive mb-2">Greške ({result.errors.length})</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.errors.map((e, i) => (
              <div key={i} className="text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-red-700 font-mono">{e}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Supplier card ─────────────────────────────────────────────────────────────

function isMinottiB2B(supplier: SupplierConfig) {
  const haystack = `${supplier.name} ${supplier.type} ${supplier.url ?? ''} ${supplier.apiUrl ?? ''}`.toLowerCase();
  return haystack.includes('minotti') || haystack.includes('b2b');
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

function selectedSummary(values: string[]) {
  if (values.length === 0) return 'Nije izabrano';
  if (values.length <= 2) return values.join(', ');
  return `${values.slice(0, 2).join(', ')} +${values.length - 2}`;
}

function FilterCheckboxList({
  title,
  values,
  selected,
  onToggle,
  loading,
  emptyLabel = 'Nema dostupnih opcija',
}: {
  title: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  loading?: boolean;
  emptyLabel?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        {selected.length > 0 && <span className="text-xs text-primary font-medium">{selected.length}</span>}
      </div>
      <div className="border border-border rounded-xl bg-card max-h-40 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-4 bg-muted rounded animate-pulse" />)}
          </div>
        ) : values.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">{emptyLabel}</div>
        ) : (
          values.map((value) => (
            <label key={value} className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => onToggle(value)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs text-foreground truncate" title={value}>{value}</span>
            </label>
          ))
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground truncate">{selectedSummary(selected)}</p>
    </div>
  );
}

function SupplierCard({
  supplier,
  onEdit,
  onDeleted,
}: {
  supplier: SupplierConfig;
  onEdit: () => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [runErr, setRunErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState<MinottiCatalogStructure>({ brands: [], categories: [], subcategories: {} });
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [filtersErr, setFiltersErr] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const availableSubcategories = [...new Set(selectedCategories.flatMap((c) => filters.subcategories[c] ?? []))];
  const [pageSize, setPageSize] = useState(100);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [replaceImages, setReplaceImages] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const minottiB2B = isMinottiB2B(supplier);
  const hasMinottiSelection = selectedBrands.length > 0 || selectedCategories.length > 0;

  const loadFilters = useCallback(async () => {
    if (!minottiB2B) return;
    setFiltersLoading(true);
    setFiltersErr('');
    try {
      const f = await getMinottiB2BCatalogStructure(supplier.id);
      setFilters(f);
    } catch (e: unknown) {
      setFiltersErr(e instanceof Error ? e.message : 'Greška pri učitavanju kataloga.');
    } finally {
      setFiltersLoading(false);
    }
  }, [minottiB2B, supplier.id]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  async function handleCsvRun(file: File) {
    setRunning(true); setResult(null); setRunErr('');
    try {
      const r = await runCsvImport(supplier.id, file);
      setResult(r);
    } catch (e) {
      setRunErr(e instanceof Error ? e.message : 'Greška pri uvozu.');
    } finally { setRunning(false); }
  }

  async function handleApiRun() {
    setRunning(true); setResult(null); setRunErr('');
    try {
      const r = await runApiImport(supplier.id);
      setResult(r);
    } catch (e) {
      setRunErr(e instanceof Error ? e.message : 'Greška pri uvozu.');
    } finally { setRunning(false); }
  }

  async function handleMinottiRun() {
    if (!hasMinottiSelection) {
      setRunErr('Izaberite bar jedan brend ili kategoriju pre pokretanja Minotti B2B uvoza.');
      return;
    }
    setRunning(true); setResult(null); setRunErr('');
    try {
      const options: MinottiB2BImportOptions = {
        pageSize,
        includeDetails,
        replaceImages,
      };
      if (selectedBrands.length > 0) options.brands = selectedBrands;
      if (selectedCategories.length > 0) options.categories = selectedCategories;
      if (selectedCategories.length > 0 && selectedSubcategories.length > 0) options.subcategories = selectedSubcategories;
      const r = await runMinottiB2BImport(supplier.id, options);
      setResult(r);
    } catch (e) {
      setRunErr(e instanceof Error ? e.message : 'Greška pri uvozu.');
    } finally { setRunning(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try { await deleteSupplier(supplier.id); onDeleted(supplier.id); }
    catch { setDeleting(false); setConfirmDel(false); }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${supplier.type === 'CSV' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
          {supplier.type === 'CSV' ? <FileText className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{supplier.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${supplier.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
              {supplier.isActive ? 'Aktivan' : 'Neaktivan'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{normalizeImportType(supplier)}</span>
          </div>
          {(supplier.url ?? supplier.apiUrl) && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{supplier.apiUrl ?? supplier.url}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Run button */}
          {normalizeImportType(supplier) === 'CSV' ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvRun(f); e.target.value = ''; }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={running || !supplier.isActive}
                title="Pokreni CSV uvoz"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Uvezi CSV</span>
              </button>
            </>
          ) : (
            <button
              onClick={minottiB2B ? handleMinottiRun : handleApiRun}
              disabled={running || !supplier.isActive || (minottiB2B && (!hasMinottiSelection || filtersLoading))}
              title={minottiB2B ? 'Pokreni Minotti B2B uvoz' : 'Pokreni API uvoz'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Povuci</span>
            </button>
          )}

          <button onClick={onEdit} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Settings className="w-4 h-4" />
          </button>

          {confirmDel ? (
            <div className="flex items-center gap-1">
              <button onClick={handleDelete} disabled={deleting} className="text-xs px-2 py-1 rounded-lg bg-destructive text-white disabled:opacity-60">
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Obriši'}
              </button>
              <button onClick={() => setConfirmDel(false)} className="text-xs px-2 py-1 rounded-lg border border-border hover:bg-muted">
                Ne
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setExpanded((p) => !p)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {runErr && (
        <div className="mx-4 mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{runErr}</div>
      )}

      {minottiB2B && (
        <div className="mx-4 mb-3 border border-border rounded-xl bg-muted/10 p-4 space-y-4">
          {/* Panel header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Minotti B2B filteri</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Izaberite brendove, kategorije ili podkategorije koje želite da povučete.
              </p>
            </div>
            <button
              onClick={loadFilters}
              disabled={filtersLoading}
              title="Osveži dostupne opcije"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
            >
              {filtersLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {filtersLoading ? 'Učitavanje...' : 'Sync'}
            </button>
          </div>

          {/* API key warning */}
          {!parseHeaders(supplier.apiHeaders ?? supplier.headers)['X-API-Key'] && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800">API ključ nije podešen</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Otvorite <button onClick={onEdit} className="underline font-medium">podešavanja dobavljača</button> i unesite X-API-Key da biste mogli da povučete listu brendova i kategorija.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {filtersErr && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span className="text-xs text-red-700 flex-1">{filtersErr}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CheckboxDropdown
              title="Brendovi"
              values={filters.brands}
              selected={selectedBrands}
              onToggle={(v) => setSelectedBrands((prev) => toggleValue(prev, v))}
              onClear={() => setSelectedBrands([])}
              loading={filtersLoading}
              placeholder="Svi brendovi"
            />
            <CheckboxDropdown
              title="Kategorije"
              values={filters.categories}
              selected={selectedCategories}
              onToggle={(v) => {
                const next = toggleValue(selectedCategories, v);
                setSelectedCategories(next);
                const validSubs = next.flatMap((c) => filters.subcategories[c] ?? []);
                setSelectedSubcategories((prev) => prev.filter((s) => validSubs.includes(s)));
              }}
              onClear={() => { setSelectedCategories([]); setSelectedSubcategories([]); }}
              loading={filtersLoading}
              placeholder="Sve kategorije"
            />
            <CheckboxDropdown
              title="Podkategorije"
              values={availableSubcategories}
              selected={selectedSubcategories}
              onToggle={(v) => setSelectedSubcategories((prev) => toggleValue(prev, v))}
              onClear={() => setSelectedSubcategories([])}
              loading={filtersLoading}
              disabled={selectedCategories.length === 0}
              disabledPlaceholder="Prvo izaberi kategoriju"
              placeholder="Sve podkategorije"
            />
            <CheckboxDropdown
              title="Opcije"
              values={['Detalji', 'Zameni slike']}
              selected={[
                ...(includeDetails ? ['Detalji'] : []),
                ...(replaceImages ? ['Zameni slike'] : []),
              ]}
              onToggle={(v) => {
                if (v === 'Detalji') setIncludeDetails((p) => !p);
                else if (v === 'Zameni slike') setReplaceImages((p) => !p);
              }}
              loading={filtersLoading}
              placeholder="Nema izabranih opcija"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Page size
              <input
                type="number"
                min={1}
                max={500}
                value={pageSize}
                onChange={(e) => setPageSize(Math.max(1, Number(e.target.value) || 100))}
                className="w-20 px-2 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            {!hasMinottiSelection && (
              <p className="text-xs text-amber-600">Izaberite bar jedan brend ili kategoriju da uvoz ne povuče sve.</p>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mx-4 mb-3">
          <ResultPanel result={result} onClose={() => setResult(null)} />
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/10">
          {normalizeImportType(supplier) === 'CSV' ? (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Mapiranje kolona</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(supplier.columnMapping ?? {}).map(([field, col]) => (
                  <div key={field} className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">{field}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-foreground">{col}</span>
                  </div>
                ))}
              </div>
              {supplier.encoding && (
                <p className="text-xs text-muted-foreground mt-2">
                  Encoding: <span className="font-medium text-foreground">{supplier.encoding}</span>
                  {supplier.delimiter && <> · Delimiter: <span className="font-medium text-foreground">{supplier.delimiter === ',' ? 'zarez (,)' : supplier.delimiter === ';' ? 'tačka-zarez (;)' : supplier.delimiter}</span></>}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">API konfiguracija</p>
              {(supplier.apiUrl ?? supplier.url) && (
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs text-muted-foreground shrink-0 mt-0.5">URL:</span>
                  <span className="text-xs font-mono text-foreground break-all">{supplier.apiUrl ?? supplier.url}</span>
                </div>
              )}
              {(() => {
                const headers = parseHeaders(supplier.apiHeaders ?? supplier.headers);
                const entries = Object.entries(headers);
                if (entries.length === 0) return (
                  <p className="text-xs text-muted-foreground">Nema konfiguriranih headera.</p>
                );
                return (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground mb-1">Headers:</p>
                    {entries.map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-muted-foreground">{k}:</span>
                        <span className="text-foreground">{v.replace(/.(?=.{4})/g, '•')}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UvozPage() {
  const [suppliers, setSuppliers] = useState<SupplierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ open: boolean; editing: SupplierConfig | null }>({ open: false, editing: null });

  const load = useCallback(() => {
    setLoading(true);
    getSuppliers()
      .then(setSuppliers)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Greška pri učitavanju'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(s: SupplierConfig) {
    setSuppliers((prev) => {
      const exists = prev.find((x) => x.id === s.id);
      return exists ? prev.map((x) => (x.id === s.id ? s : x)) : [s, ...prev];
    });
    setModal({ open: false, editing: null });
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Uvoz proizvoda
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upravljajte konfiguracijama dobavljača i pokretajte uvoz iz CSV fajlova ili API-ja
            </p>
          </div>
          <button
            onClick={() => setModal({ open: true, editing: null })}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors sm:shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novi dobavljač
          </button>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-start gap-3">
          <RefreshCw className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Uvoz automatski <strong>kreira proizvod</strong> ako ne postoji (po SKU), <strong>ažurira</strong> ga ako postoji,
            i <strong>kreira atribute/vrednosti</strong> ako ne postoje. Vraća detaljan izveštaj o rezultatu.
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Supplier list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Nema konfiguracija dobavljača</p>
            <p className="text-xs text-muted-foreground mb-4">Kreirajte prvog dobavljača da biste počeli uvoz</p>
            <button
              onClick={() => setModal({ open: true, editing: null })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" /> Novi dobavljač
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {suppliers.map((s) => (
              <SupplierCard
                key={s.id}
                supplier={s}
                onEdit={() => setModal({ open: true, editing: s })}
                onDeleted={(id) => setSuppliers((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        )}
      </div>

      {modal.open && (
        <SupplierModal
          initial={modal.editing}
          onSave={handleSaved}
          onClose={() => setModal({ open: false, editing: null })}
        />
      )}
    </DashboardLayout>
  );
}
