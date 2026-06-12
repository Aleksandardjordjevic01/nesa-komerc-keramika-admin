'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';

export interface CheckboxDropdownProps {
  title: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear?: () => void;
  loading?: boolean;
  disabled?: boolean;
  disabledPlaceholder?: string;
  placeholder?: string;
  className?: string;
}

export function CheckboxDropdown({
  title,
  values,
  selected,
  onToggle,
  onClear,
  loading = false,
  disabled = false,
  disabledPlaceholder,
  placeholder,
  className = '',
}: CheckboxDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const calcStyle = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const MAX_H = 320;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const goUp = spaceBelow < MAX_H && spaceAbove > spaceBelow;
    setDropdownStyle({
      position: 'fixed',
      top: goUp ? rect.top - Math.min(MAX_H, spaceAbove) - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: goUp ? Math.min(MAX_H, spaceAbove) : Math.min(MAX_H, spaceBelow),
      zIndex: 9999,
    });
  }, []);

  function handleToggleOpen() {
    if (disabled || loading) return;
    if (!open) calcStyle();
    setOpen((p) => !p);
  }

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    function onScrollResize() {
      if (!triggerRef.current) return setOpen(false);
      const rect = triggerRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) setOpen(false);
      else calcStyle();
    }
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open, calcStyle]);

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (portalRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Clear search when closing
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const filtered = search.trim()
    ? values.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : values;

  const buttonLabel = disabled
    ? (disabledPlaceholder ?? placeholder ?? title)
    : loading
      ? 'Učitavanje...'
      : selected.length === 0
        ? (placeholder ?? `Izaberi ${title.toLowerCase()}`)
        : selected.length === 1
          ? selected[0]
          : `${selected.length} izabrano`;

  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{title}</p>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggleOpen}
        disabled={disabled || loading}
        className={[
          'w-full flex items-center justify-between px-3 py-2.5 text-sm border rounded-xl bg-card transition-colors',
          disabled
            ? 'opacity-50 cursor-not-allowed border-border'
            : open
              ? 'border-primary/60 ring-2 ring-primary/20'
              : 'border-border hover:border-primary/50',
          !disabled && selected.length > 0 ? 'border-primary/40' : '',
        ].join(' ')}
      >
        <span className={`truncate ${!disabled && selected.length > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
          {buttonLabel}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {!disabled && selected.length > 0 && (
            <span className="text-xs bg-primary text-white rounded-full px-1.5 min-w-[20px] text-center font-medium">
              {selected.length}
            </span>
          )}
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            : <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          }
        </div>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={portalRef}
          style={dropdownStyle}
          className="bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col"
        >
          {/* Search — shown when more than 6 options */}
          {values.length > 6 && (
            <div className="p-2 border-b border-border shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pretraži..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Clear all */}
          {selected.length > 0 && onClear && (
            <button
              onClick={() => { onClear(); setOpen(false); }}
              className="px-3 py-2 text-xs text-left text-primary hover:bg-primary/5 border-b border-border transition-colors shrink-0 font-medium"
            >
              Poništi izbor ({selected.length})
            </button>
          )}

          {/* Options list */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-5 text-xs text-muted-foreground text-center">
                {search ? 'Nema rezultata pretrage' : 'Nema dostupnih opcija'}
              </div>
            ) : (
              filtered.map((value) => (
                <label
                  key={value}
                  className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/40 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(value)}
                    onChange={() => onToggle(value)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary shrink-0"
                  />
                  <span className="text-sm text-foreground truncate">{value}</span>
                </label>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
