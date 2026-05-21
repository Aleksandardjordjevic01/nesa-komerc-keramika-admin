'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '../../../components/layout/dashboard-layout';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  X,
  GripVertical,
  LayoutGrid,
  ImagePlus,
  Loader2,
} from 'lucide-react';
import {
  getAdminCategoryTree,
  getAdminCategoryFlat,
  createAdminCategory,
  updateAdminCategory,
  updateAdminCategoryStatus,
  deleteAdminCategory,
  reorderAdminCategories,
  type AdminCategoryNode,
  type AdminFlatCategory,
} from '../../../lib/api/categories';
import { uploadCategoryIcon, uploadCategoryImage } from '../../../lib/api/upload';
import { SelectDropdown } from '../../../components/shared/select-dropdown';

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'inactive';

interface ModalState {
  open: boolean;
  mode: 'create' | 'edit';
  parentId: string | null;
  category: AdminCategoryNode | null;
}

interface DragState {
  draggedId: string | null;
  dragOverId: string | null;
  disabled: boolean;
  onDragStart: (node: AdminCategoryNode) => void;
  onDragOver: (e: React.DragEvent, node: AdminCategoryNode) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, node: AdminCategoryNode) => void;
  onDragEnd: () => void;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function flattenTree(nodes: AdminCategoryNode[], result: AdminCategoryNode[] = []): AdminCategoryNode[] {
  for (const node of nodes) {
    result.push(node);
    if (node.children.length) flattenTree(node.children, result);
  }
  return result;
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  description,
  confirmLabel = 'Potvrdi',
  destructive = false,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm mx-4 shadow-lg text-center">
        <p className="text-base font-semibold text-foreground mb-2">{title}</p>
        {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
        {!description && <div className="mb-6" />}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors border border-border disabled:opacity-50"
          >
            Odustani
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-colors ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {loading ? 'Brisanje...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Category Form Modal ────────────────────────────────────────────────────────

function CategoryModal({
  mode,
  category,
  parentId,
  flatList,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  category: AdminCategoryNode | null;
  parentId: string | null;
  flatList: AdminFlatCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? '');
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? '');
  const [iconUploading, setIconUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string>(
    category?.parentId ?? parentId ?? '',
  );
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState<number>(category?.sortOrder ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Naziv je obavezan'); return; }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        icon: icon.trim() || null,
        imageUrl: imageUrl.trim() || null,
        parentId: selectedParentId || null,
        isActive,
        sortOrder,
      };
      if (mode === 'create') {
        await createAdminCategory(payload);
      } else if (category) {
        await updateAdminCategory(category.id, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri čuvanju');
    } finally {
      setLoading(false);
    }
  }

  // Build parent options, excluding self and descendants when editing
  const selfAndDescendants = new Set<string>();
  if (category) {
    // Quick DFS to get all descendants from flatList doesn't preserve children structure,
    // so we do it via parent tracking
    const isDescendantOf = (candidate: AdminFlatCategory): boolean => {
      let cur: string | null = candidate.parentId;
      while (cur) {
        if (cur === category.id) return true;
        const parent = flatList.find((f) => f.id === cur);
        cur = parent?.parentId ?? null;
      }
      return false;
    };
    selfAndDescendants.add(category.id);
    for (const f of flatList) {
      if (isDescendantOf(f)) selfAndDescendants.add(f.id);
    }
  }

  const parentOptions = flatList.filter((f) => !selfAndDescendants.has(f.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-foreground">
            {mode === 'create' ? 'Dodaj kategoriju' : 'Izmeni kategoriju'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Naziv <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="npr. Elektronika"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              autoFocus
            />
          </div>

          {/* Icon upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Ikonica (SVG) <span className="text-muted-foreground text-xs font-normal">(opciono)</span>
            </label>
            <div className="flex items-center gap-3">
              {icon ? (
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-lg border border-border bg-muted/40 flex items-center justify-center">
                    <img src={icon} alt="ikonica" className="w-8 h-8 object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIcon('')}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center shadow-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg border border-dashed border-border bg-muted/20 flex items-center justify-center shrink-0">
                  <ImagePlus className="w-5 h-5 text-muted-foreground/40" />
                </div>
              )}
              <label className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg bg-background hover:bg-muted/50 transition-colors">
                  {iconUploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin text-primary" /><span className="text-muted-foreground">Uploadovanje...</span></>
                  ) : (
                    <span className="text-muted-foreground">{icon ? 'Zameni SVG ikonicu' : 'Izaberi SVG fajl...'}</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/svg+xml"
                  className="hidden"
                  disabled={iconUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIconUploading(true);
                    try {
                      const url = await uploadCategoryIcon(file);
                      setIcon(url);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Greška pri uploadu ikonice');
                    } finally {
                      setIconUploading(false);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Slika kategorije <span className="text-muted-foreground text-xs font-normal">(opciono)</span>
            </label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-lg border border-border overflow-hidden">
                    <img src={imageUrl} alt="slika" className="w-full h-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center shadow-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg border border-dashed border-border bg-muted/20 flex items-center justify-center shrink-0">
                  <ImagePlus className="w-5 h-5 text-muted-foreground/40" />
                </div>
              )}
              <label className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg bg-background hover:bg-muted/50 transition-colors">
                  {imageUploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin text-primary" /><span className="text-muted-foreground">Uploadovanje...</span></>
                  ) : (
                    <span className="text-muted-foreground">{imageUrl ? 'Zameni sliku' : 'Izaberi sliku...'}</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={imageUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImageUploading(true);
                    try {
                      const url = await uploadCategoryImage(file);
                      setImageUrl(url);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Greška pri uploadu slike');
                    } finally {
                      setImageUploading(false);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* Parent */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Roditeljska kategorija
            </label>
            <SelectDropdown
              value={selectedParentId}
              onChange={setSelectedParentId}
              options={[
                { value: '', label: 'Glavna' },
                ...parentOptions.map((f) => ({
                  value: f.id,
                  label: `${'  '.repeat(f.level)}${f.level > 0 ? '↳ ' : ''}${f.name}`,
                })),
              ]}
            />
          </div>

          {/* Status */}
          <div className="flex items-center justify-between py-1">
            <label className="text-sm font-medium text-foreground">Aktivna</label>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isActive ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              Odustani
            </button>
            <button
              type="submit"
              disabled={loading || iconUploading || imageUploading}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Čuvanje...' : mode === 'create' ? 'Dodaj' : 'Sačuvaj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Category Row ───────────────────────────────────────────────────────────────

function CategoryRow({
  node,
  depth,
  onAdd,
  onEdit,
  onToggleStatus,
  onDelete,
  dragState,
}: {
  node: AdminCategoryNode;
  depth: number;
  onAdd: (parentId: string) => void;
  onEdit: (node: AdminCategoryNode) => void;
  onToggleStatus: (node: AdminCategoryNode) => void;
  onDelete: (node: AdminCategoryNode) => void;
  dragState: DragState;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDragging = dragState.draggedId === node.id;
  const isDraggedOver = dragState.dragOverId === node.id;

  return (
    <>
      <tr
        draggable={!dragState.disabled}
        onDragStart={() => dragState.onDragStart(node)}
        onDragOver={(e) => dragState.onDragOver(e, node)}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) dragState.onDragLeave();
        }}
        onDrop={(e) => dragState.onDrop(e, node)}
        onDragEnd={dragState.onDragEnd}
        className={`border-b border-border/40 transition-colors ${!node.isActive ? 'opacity-60' : ''} ${isDragging ? 'opacity-30 bg-muted/50' : 'hover:bg-muted/30'} ${isDraggedOver ? 'bg-primary/5 shadow-[inset_0_2px_0_0_hsl(var(--primary)/0.4)]' : ''}`}
      >
        {/* Name */}
        <td className="py-3 pl-4 pr-4">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
            {!dragState.disabled && (
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 cursor-grab active:cursor-grabbing shrink-0 hover:text-muted-foreground/60 transition-colors" />
            )}
            {node.children.length > 0 ? (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="w-5" />
            )}
            {expanded && node.children.length > 0 ? (
              <FolderOpen className="h-4 w-4 text-primary/70 shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            )}
            <span className="font-medium text-sm text-foreground ml-1">{node.name}</span>
            {node.icon && (
              <span className="text-xs text-muted-foreground ml-1 font-mono">({node.icon})</span>
            )}
          </div>
        </td>

        {/* Slug */}
        <td className="py-3 pr-4">
          <span className="text-xs font-mono text-muted-foreground">{node.slug}</span>
        </td>

        {/* Level */}
        <td className="py-3 pr-4 text-center">
          <span className="text-sm text-muted-foreground">{node.level}</span>
        </td>

        {/* Counts */}
        <td className="py-3 pr-4 text-center">
          <span className="text-sm text-foreground">{node.directListingsCount}</span>
        </td>
        <td className="py-3 pr-4 text-center">
          <span className="text-sm font-medium text-foreground">{node.totalListingsCount}</span>
        </td>

        {/* Status */}
        <td className="py-3 pr-4">
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              node.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${node.isActive ? 'bg-primary' : 'bg-muted-foreground'}`} />
            {node.isActive ? 'Aktivna' : 'Neaktivna'}
          </span>
        </td>

        {/* Actions */}
        <td className="py-3 pr-4">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => onAdd(node.id)}
              title="Dodaj potkategoriju"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onEdit(node)}
              title="Izmeni"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onToggleStatus(node)}
              title={node.isActive ? 'Deaktiviraj' : 'Aktiviraj'}
              className={`p-1.5 rounded-lg transition-colors ${
                node.isActive
                  ? 'text-muted-foreground hover:text-orange-600 hover:bg-orange-50'
                  : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
              }`}
            >
              {node.isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => onDelete(node)}
              title="Obriši"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {expanded &&
        node.children.map((child) => (
          <CategoryRow
            key={child.id}
            node={child}
            depth={depth + 1}
            onAdd={onAdd}
            onEdit={onEdit}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
            dragState={dragState}
          />
        ))}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function KategorijeAdminPage() {
  const [tree, setTree] = useState<AdminCategoryNode[]>([]);
  const [flatList, setFlatList] = useState<AdminFlatCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modal state
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'create', parentId: null, category: null });
  const [confirmDelete, setConfirmDelete] = useState<AdminCategoryNode | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = {
        search: debouncedSearch || undefined,
        status: statusFilter !== 'all' ? (statusFilter as 'active' | 'inactive') : undefined,
      };
      const [treeData, flatData] = await Promise.all([
        getAdminCategoryTree(query),
        getAdminCategoryFlat(),
      ]);
      setTree(treeData);
      setFlatList(flatData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri učitavanju');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Toast helper
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Handlers
  function handleAdd(parentId?: string) {
    setModal({ open: true, mode: 'create', parentId: parentId ?? null, category: null });
  }

  function handleEdit(node: AdminCategoryNode) {
    setModal({ open: true, mode: 'edit', parentId: null, category: node });
  }

  async function handleToggleStatus(node: AdminCategoryNode) {
    try {
      await updateAdminCategoryStatus(node.id, !node.isActive);
      showToast(node.isActive ? 'Kategorija je deaktivirana.' : 'Kategorija je aktivirana.');
      fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Greška pri promjeni statusa');
    }
  }

  function handleDeleteClick(node: AdminCategoryNode) {
    setConfirmDelete(node);
  }

  async function handleDeleteConfirm() {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      await deleteAdminCategory(confirmDelete.id);
      showToast('Kategorija je obrisana.');
      setConfirmDelete(null);
      fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nije moguće obrisati kategoriju.');
      setConfirmDelete(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleModalSaved() {
    setModal({ open: false, mode: 'create', parentId: null, category: null });
    showToast(modal.mode === 'create' ? 'Kategorija je kreirana.' : 'Kategorija je ažurirana.');
    fetchData();
  }

  // Drag handlers
  function handleDragStart(node: AdminCategoryNode) {
    setDraggedId(node.id);
  }

  function handleDragOver(e: React.DragEvent, node: AdminCategoryNode) {
    e.preventDefault();
    if (!draggedId || node.id === draggedId) return;
    const allNodes = flattenTree(tree);
    const draggedNode = allNodes.find((n) => n.id === draggedId);
    if (!draggedNode || draggedNode.parentId !== node.parentId) return;
    setDragOverId(node.id);
  }

  function handleDragLeave() {
    setDragOverId(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
  }

  async function handleDrop(e: React.DragEvent, targetNode: AdminCategoryNode) {
    e.preventDefault();
    const allNodes = flattenTree(tree);
    const draggedNode = allNodes.find((n) => n.id === draggedId);
    setDraggedId(null);
    setDragOverId(null);

    if (!draggedNode || draggedNode.id === targetNode.id) return;
    if (draggedNode.parentId !== targetNode.parentId) return;

    const siblings = allNodes
      .filter((n) => n.parentId === draggedNode.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const withoutDragged = siblings.filter((s) => s.id !== draggedNode.id);
    const targetIdx = withoutDragged.findIndex((s) => s.id === targetNode.id);
    if (targetIdx === -1) return;

    withoutDragged.splice(targetIdx, 0, draggedNode);

    const items = withoutDragged.map((s, i) => ({
      id: s.id,
      sortOrder: i,
      parentId: s.parentId,
    }));

    try {
      await reorderAdminCategories(items);
      showToast('Redosled kategorija je sačuvan.');
      fetchData();
    } catch {
      showToast('Greška pri čuvanju redosleda.');
    }
  }

  const dragState: DragState = {
    draggedId,
    dragOverId,
    disabled: !!debouncedSearch || statusFilter !== 'all',
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    onDragEnd: handleDragEnd,
  };

  const totalCount = flattenTree(tree).length;
  const activeCount = flattenTree(tree).filter((n) => n.isActive).length;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2"><LayoutGrid className="w-5 h-5 text-primary" />Kategorije</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalCount} ukupno · {activeCount} aktivnih
            </p>
          </div>
          <button
            onClick={() => handleAdd()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Dodaj kategoriju
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Status tabs */}
          <div className="flex gap-1 bg-card rounded-lg p-1 border border-border">
            {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-white font-medium shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'all' ? 'Sve' : s === 'active' ? 'Aktivne' : 'Neaktivne'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs flex items-center">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Pretraži kategorije..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-3 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
              Učitavanje...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20 text-red-600 text-sm">
              {error}
            </div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Folder className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm">
                {debouncedSearch || statusFilter !== 'all'
                  ? 'Nema kategorija koje odgovaraju filteru.'
                  : 'Nema kategorija. Dodajte prvu.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-3 pl-4 pr-4 w-[35%] text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Naziv
                    </th>
                    <th className="py-3 pr-4 w-[22%] text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Slug
                    </th>
                    <th className="py-3 pr-4 w-[7%] text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Nivo
                    </th>
                    <th className="py-3 pr-4 w-[8%] text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Direktno
                    </th>
                    <th className="py-3 pr-4 w-[8%] text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Ukupno
                    </th>
                    <th className="py-3 pr-4 w-[10%] text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Status
                    </th>
                    <th className="py-3 pr-4 w-[10%] text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Akcije
                    </th>
                  </tr>
                </thead>
                <tbody className="pl-4">
                  {tree.map((node) => (
                    <CategoryRow
                      key={node.id}
                      node={node}
                      depth={0}
                      onAdd={handleAdd}
                      onEdit={handleEdit}
                      onToggleStatus={handleToggleStatus}
                      onDelete={handleDeleteClick}
                      dragState={dragState}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Category Form Modal */}
      {modal.open && (
        <CategoryModal
          mode={modal.mode}
          category={modal.category}
          parentId={modal.parentId}
          flatList={flatList}
          onClose={() => setModal({ open: false, mode: 'create', parentId: null, category: null })}
          onSaved={handleModalSaved}
        />
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <ConfirmModal
          title={`Obriši kategoriju "${confirmDelete.name}"?`}
          description={
            confirmDelete.children.length > 0 || confirmDelete.totalListingsCount > 0
              ? 'Upozorenje: kategorija ima potkategorije ili oglase. Brisanje nije moguće.'
              : 'Ova akcija je nepovratna.'
          }
          confirmLabel="Obriši"
          destructive
          loading={deleteLoading}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background text-sm font-medium px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
