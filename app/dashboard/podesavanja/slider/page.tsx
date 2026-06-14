'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '../../../../components/layout/dashboard-layout';
import {
  getAdminSlides,
  createSlide,
  updateSlide,
  deleteSlide,
  reorderSlides,
  uploadSliderImage,
  type Slide,
} from '../../../../lib/api/client';
import {
  ArrowLeft,
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  ImageIcon,
  ToggleLeft,
  ToggleRight,
  Layers,
} from 'lucide-react';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace('/api/v1', '');

function fullImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http')) return trimmed;
  return `${BASE_URL}${trimmed}`;
}

// ── Image upload zone ─────────────────────────────────────────────────────────

function ImageUploadZone({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setUploadErr('Dozvoljene su samo slike.');
      return;
    }
    setUploading(true);
    setUploadErr('');
    try {
      const url = await uploadSliderImage(file);
      onChange(url);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Greška pri uploadu.');
    } finally {
      setUploading(false);
    }
  }

  const preview = fullImageUrl(value);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-muted-foreground">Slika slajda *</label>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border group">
          <img src={preview} alt="preview" className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-white text-foreground text-xs font-medium hover:bg-white/90 transition-colors"
            >
              Promeni sliku
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }`}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm text-foreground font-medium">Prevuci sliku ovde</p>
                <p className="text-xs text-muted-foreground">ili klikni da izabereš fajl</p>
              </div>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      {uploadErr && <p className="text-xs text-destructive">{uploadErr}</p>}
    </div>
  );
}

// ── Slide modal ───────────────────────────────────────────────────────────────

interface SlideDraft {
  imageUrl: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
  isActive: boolean;
}

const EMPTY_DRAFT: SlideDraft = {
  imageUrl: '',
  title: '',
  subtitle: '',
  buttonText: '',
  buttonUrl: '',
  isActive: true,
};

function SlideModal({
  slide,
  onClose,
  onSaved,
}: {
  slide: Slide | null;
  onClose: () => void;
  onSaved: (s: Slide) => void;
}) {
  const [draft, setDraft] = useState<SlideDraft>(
    slide
      ? {
          imageUrl: slide.imageUrl,
          title: slide.title ?? '',
          subtitle: slide.subtitle ?? '',
          buttonText: slide.buttonText ?? '',
          buttonUrl: slide.buttonUrl ?? '',
          isActive: slide.isActive,
        }
      : EMPTY_DRAFT,
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function set<K extends keyof SlideDraft>(key: K, val: SlideDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    if (!draft.imageUrl) {
      setErr('Slika je obavezna.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        imageUrl: draft.imageUrl,
        title: draft.title || null,
        subtitle: draft.subtitle || null,
        buttonText: draft.buttonText || null,
        buttonUrl: draft.buttonUrl || null,
        isActive: draft.isActive,
        sortOrder: slide?.sortOrder ?? 0,
      };
      const saved = slide
        ? await updateSlide(slide.id, payload)
        : await createSlide(payload);
      onSaved(saved);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Greška pri čuvanju.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">
            {slide ? 'Uredi slajd' : 'Novi slajd'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">
          <ImageUploadZone value={draft.imageUrl} onChange={(url) => set('imageUrl', url)} />

          <div>
            <label className={labelCls}>Naslov (opciono)</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="npr. Nova kolekcija keramike"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Podnaslov (opciono)</label>
            <input
              type="text"
              value={draft.subtitle}
              onChange={(e) => set('subtitle', e.target.value)}
              placeholder="npr. Otkrijte naš novi asortiman"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tekst dugmeta (opciono)</label>
              <input
                type="text"
                value={draft.buttonText}
                onChange={(e) => set('buttonText', e.target.value)}
                placeholder="npr. Pogledaj"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Link dugmeta (opciono)</label>
              <input
                type="text"
                value={draft.buttonUrl}
                onChange={(e) => set('buttonUrl', e.target.value)}
                placeholder="npr. /kategorije/plocice"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Aktivan</p>
              <p className="text-xs text-muted-foreground">Prikazuje se na sajtu</p>
            </div>
            <button
              type="button"
              onClick={() => set('isActive', !draft.isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                draft.isActive ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  draft.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {err && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">
              {err}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Odustani
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {slide ? 'Sačuvaj izmene' : 'Dodaj slajd'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mx-auto mb-4">
          <Trash2 className="w-7 h-7 text-destructive" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">Obriši slajd?</h3>
        <p className="text-sm text-muted-foreground mb-6">Ova akcija je nepovratna.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Odustani
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Brisanje...' : 'Obriši'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SliderPage() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [modalSlide, setModalSlide] = useState<Slide | null | true>(null);
  const [deleteTarget, setDeleteTarget] = useState<Slide | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Drag & drop state
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminSlides();
      setSlides(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri učitavanju.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  // ── Toggle active ──────────────────────────────────────────────────────────
  async function handleToggle(slide: Slide) {
    setTogglingId(slide.id);
    try {
      const updated = await updateSlide(slide.id, { isActive: !slide.isActive });
      setSlides((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Greška.');
    } finally {
      setTogglingId(null);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSlide(deleteTarget.id);
      setSlides((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast('Slajd je obrisan.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Greška pri brisanju.');
    } finally {
      setDeleting(false);
    }
  }

  // ── Modal saved ────────────────────────────────────────────────────────────
  function handleSaved(saved: Slide) {
    setSlides((prev) => {
      const exists = prev.find((s) => s.id === saved.id);
      return exists
        ? prev.map((s) => (s.id === saved.id ? saved : s))
        : [...prev, saved];
    });
    setModalSlide(null);
    showToast(modalSlide === true ? 'Slajd je dodat.' : 'Slajd je ažuriran.');
  }

  // ── Drag & drop reorder ────────────────────────────────────────────────────
  function handleDragStart(idx: number) {
    dragIndex.current = idx;
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOver(idx);
  }

  async function handleDrop(targetIdx: number) {
    const fromIdx = dragIndex.current;
    if (fromIdx === null || fromIdx === targetIdx) {
      dragIndex.current = null;
      setDragOver(null);
      return;
    }

    const reordered = [...slides];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    const withOrder = reordered.map((s, i) => ({ ...s, sortOrder: i }));
    setSlides(withOrder);
    dragIndex.current = null;
    setDragOver(null);

    setReordering(true);
    try {
      await reorderSlides(withOrder.map((s) => ({ id: s.id, sortOrder: s.sortOrder })));
    } catch {
      showToast('Greška pri čuvanju redosleda.');
      void load();
    } finally {
      setReordering(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/dashboard/podesavanja"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Podešavanja
            </Link>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Slider
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upravljajte slajdovima hero sekcije na sajtu
            </p>
          </div>
          <button
            onClick={() => setModalSlide(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors sm:shrink-0"
          >
            <Plus className="w-4 h-4" />
            Dodaj slajd
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {reordering && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Čuvanje redosleda...
          </div>
        )}

        {/* Slides list */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))
          ) : slides.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">Nema slajdova. Dodajte prvi slajd.</p>
              <button
                onClick={() => setModalSlide(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Dodaj slajd
              </button>
            </div>
          ) : (
            slides.map((slide, idx) => {
              const img = fullImageUrl(slide.imageUrl);
              return (
                <div
                  key={slide.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => void handleDrop(idx)}
                  onDragEnd={() => setDragOver(null)}
                  className={`bg-card border rounded-xl overflow-hidden flex items-center gap-4 px-4 py-3 transition-all ${
                    dragOver === idx ? 'border-primary shadow-md scale-[1.01]' : 'border-border'
                  }`}
                >
                  {/* Drag handle */}
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />

                  {/* Thumbnail */}
                  <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                    {img ? (
                      <img src={img} alt={slide.title ?? 'slajd'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {slide.title || <span className="text-muted-foreground italic">Bez naslova</span>}
                    </p>
                    {slide.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{slide.subtitle}</p>
                    )}
                    {slide.buttonText && slide.buttonUrl && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        Dugme: {slide.buttonText} → {slide.buttonUrl}
                      </p>
                    )}
                  </div>

                  {/* Status badge */}
                  <span
                    className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      slide.isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {slide.isActive ? 'Aktivno' : 'Neaktivno'}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Toggle */}
                    <button
                      onClick={() => void handleToggle(slide)}
                      disabled={togglingId === slide.id}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-60"
                      title={slide.isActive ? 'Deaktiviraj' : 'Aktiviraj'}
                    >
                      {togglingId === slide.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : slide.isActive ? (
                        <ToggleRight className="w-4 h-4 text-primary" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => setModalSlide(slide)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title="Uredi"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setDeleteTarget(slide)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Obriši"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {slides.length > 1 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5" />
            Prevucite kartice da promenite redosled slajdova
          </p>
        )}
      </div>

      {/* Modals */}
      {modalSlide !== null && (
        <SlideModal
          slide={modalSlide === true ? null : modalSlide}
          onClose={() => setModalSlide(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-foreground text-background rounded-xl text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
