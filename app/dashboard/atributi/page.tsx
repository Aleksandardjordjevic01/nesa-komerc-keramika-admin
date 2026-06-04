'use client';

import { useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  Loader2,
  Search,
} from 'lucide-react';
import {
  getAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
  type Attribute,
  type AttributeValue,
} from '../../../lib/api/client';

// ── Inline editable value chip ────────────────────────────────────────────────

function ValueChip({
  val,
  attributeId,
  onSaved,
  onDeleted,
}: {
  val: AttributeValue;
  attributeId: string;
  onSaved: (updated: AttributeValue) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(val.value);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setText(val.value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function save() {
    if (!text.trim() || text.trim() === val.value) { setEditing(false); return; }
    setSaving(true);
    try {
      const updated = await updateAttributeValue(attributeId, val.id, text.trim());
      onSaved(updated);
      setEditing(false);
    } catch { /* keep editing */ }
    finally { setSaving(false); }
  }

  async function del() {
    setDeleting(true);
    try { await deleteAttributeValue(attributeId, val.id); onDeleted(val.id); }
    catch { setDeleting(false); }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-lg px-2 py-1">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="text-xs bg-transparent outline-none w-24 text-foreground"
        />
        <button onClick={save} disabled={saving} className="text-green-600 hover:text-green-700">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        </button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 group bg-muted border border-border rounded-lg px-2.5 py-1 text-xs text-foreground">
      {val.value}
      <button onClick={startEdit} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity ml-0.5">
        <Pencil className="w-2.5 h-2.5" />
      </button>
      <button onClick={del} disabled={deleting} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
        {deleting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <X className="w-2.5 h-2.5" />}
      </button>
    </span>
  );
}

// ── Add value inline input ────────────────────────────────────────────────────

function AddValueInput({ attributeId, onAdded }: { attributeId: string; onAdded: (v: AttributeValue) => void }) {
  const [show, setShow] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function open() { setShow(true); setTimeout(() => inputRef.current?.focus(), 0); }

  async function save() {
    if (!text.trim()) { setShow(false); return; }
    setSaving(true);
    try {
      const v = await createAttributeValue(attributeId, text.trim());
      onAdded(v);
      setText('');
      inputRef.current?.focus();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  if (!show) {
    return (
      <button
        onClick={open}
        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 border border-dashed border-primary/40 rounded-lg px-2.5 py-1 transition-colors"
      >
        <Plus className="w-3 h-3" /> Dodaj vrednost
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 border border-primary/40 rounded-lg px-2 py-1 bg-card">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setShow(false); }}
        placeholder="Nova vrednost..."
        className="text-xs bg-transparent outline-none w-28 text-foreground placeholder:text-muted-foreground"
      />
      <button onClick={save} disabled={saving} className="text-green-600 hover:text-green-700">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      </button>
      <button onClick={() => setShow(false)} className="text-muted-foreground hover:text-foreground">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ── Attribute row ─────────────────────────────────────────────────────────────

function AttributeRow({
  attr,
  onUpdated,
  onDeleted,
}: {
  attr: Attribute;
  onUpdated: (a: Attribute) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState(attr.name);
  const [savingName, setSavingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  function startEditName() {
    setNameText(attr.name);
    setEditingName(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  }

  async function saveName() {
    if (!nameText.trim() || nameText.trim() === attr.name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      const updated = await updateAttribute(attr.id, nameText.trim());
      onUpdated(updated);
      setEditingName(false);
    } catch { /* keep editing */ }
    finally { setSavingName(false); }
  }

  async function del() {
    setDeleting(true);
    try { await deleteAttribute(attr.id); onDeleted(attr.id); }
    catch { setDeleting(false); setConfirmDelete(false); }
  }

  function handleValueSaved(updated: AttributeValue) {
    onUpdated({ ...attr, values: (attr.values ?? []).map((v) => (v.id === updated.id ? updated : v)) });
  }

  function handleValueDeleted(id: string) {
    onUpdated({ ...attr, values: (attr.values ?? []).filter((v) => v.id !== id) });
  }

  function handleValueAdded(v: AttributeValue) {
    onUpdated({ ...attr, values: [...(attr.values ?? []), v] });
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border/50">
        <button
          onClick={() => setExpanded((p) => !p)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {editingName ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              ref={nameRef}
              value={nameText}
              onChange={(e) => setNameText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
              className="text-sm font-medium bg-card border border-border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary/40 flex-1 max-w-xs"
            />
            <button onClick={saveName} disabled={savingName} className="text-green-600 hover:text-green-700">
              {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={() => setEditingName(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="flex-1 text-sm font-semibold text-foreground">{attr.name}</span>
        )}

        <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
          {attr.values?.length ?? 0} vrednosti
        </span>

        {!editingName && (
          <div className="flex items-center gap-1">
            <button
              onClick={startEditName}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Preimenuj"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1 ml-1">
                <span className="text-xs text-destructive">Obrisati?</span>
                <button
                  onClick={del}
                  disabled={deleting}
                  className="text-xs px-2 py-1 rounded-lg bg-destructive text-white hover:bg-destructive/90 disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Da'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2 py-1 rounded-lg border border-border hover:bg-muted"
                >
                  Ne
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
                title="Obriši atribut"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Values */}
      {expanded && (
        <div className="px-4 py-3 flex flex-wrap gap-2 bg-card">
          {(attr.values ?? []).map((v) => (
            <ValueChip
              key={v.id}
              val={v}
              attributeId={attr.id}
              onSaved={handleValueSaved}
              onDeleted={handleValueDeleted}
            />
          ))}
          <AddValueInput attributeId={attr.id} onAdded={handleValueAdded} />
          {(attr.values?.length ?? 0) === 0 && (
            <span className="text-xs text-muted-foreground italic">Nema vrednosti — dodaj prvu</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AtributiPage() {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAttributes()
      .then(setAttributes)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Greška pri učitavanju'))
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setCreating(true);
    setNewName('');
    setTimeout(() => newInputRef.current?.focus(), 0);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const a = await createAttribute(newName.trim());
      setAttributes((prev) => [a, ...prev]);
      setCreating(false);
      setNewName('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Greška pri kreiranju');
    } finally {
      setSaving(false);
    }
  }

  const filtered = search.trim()
    ? attributes.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : attributes;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Atributi proizvoda
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upravljajte atributima i njihovim vrednostima (npr. Boja → Bela, Crna; Veličina → S, M, L)
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors sm:shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novi atribut
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pretraži atribute..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Create new attribute inline */}
        {creating && (
          <div className="border border-primary/40 rounded-xl px-4 py-3 bg-card flex items-center gap-3">
            <Tag className="w-4 h-4 text-primary shrink-0" />
            <input
              ref={newInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
              placeholder="Ime atributa (npr. Boja, Veličina...)"
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-60 hover:bg-primary/90"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Sačuvaj
            </button>
            <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {search ? 'Nema rezultata za pretragu.' : 'Nema atributa. Kreirajte prvi!'}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((attr) => (
              <AttributeRow
                key={attr.id}
                attr={attr}
                onUpdated={(updated) => setAttributes((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))}
                onDeleted={(id) => setAttributes((prev) => prev.filter((a) => a.id !== id))}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
