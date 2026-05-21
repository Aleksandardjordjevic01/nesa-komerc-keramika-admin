'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import { Search, X, ChevronDown } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IconItem {
  name: string;
  label: string;
}

interface IconGroup {
  group: string;
  icons: IconItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/** Convert kebab-case icon name to PascalCase for lucide-react lookup */
function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const pascal = toPascalCase(name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (LucideIcons as any)[pascal] as React.FC<{ className?: string }> | undefined;
  if (!Icon) return <span className="text-muted-foreground text-[10px]">?</span>;
  return <Icon className={className} />;
}

// ── IconPicker ────────────────────────────────────────────────────────────────

interface IconPickerProps {
  value: string | null;
  onChange: (name: string | null) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<IconGroup[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch icon list from API once
  useEffect(() => {
    setLoading(true);
    void fetch(`${API_URL}/icons`)
      .then((r) => r.json())
      .then((json: { success: boolean; data: IconGroup[] }) => {
        setGroups(json.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current && !triggerRef.current.contains(target)) {
        // Also check if click is inside the portal dropdown
        const portal = document.getElementById('icon-picker-portal');
        if (!portal || !portal.contains(target)) {
          setOpen(false);
          setSearch('');
        }
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Focus search when panel opens
  useEffect(() => {
    if (open) {
      // Position the fixed dropdown relative to the trigger button
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropdownHeight = 320;
        const goUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
        setDropdownStyle({
          position: 'fixed',
          top: goUp ? rect.top - dropdownHeight - 6 : rect.bottom + 6,
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
        });
      }
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen((o) => {
      if (o) setSearch('');
      return !o;
    });
  }, []);

  const handleSelect = useCallback(
    (name: string) => {
      onChange(name === value ? null : name);
      setOpen(false);
      setSearch('');
    },
    [onChange, value],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange],
  );

  // Filter icons by search
  const filtered: IconGroup[] = search.trim()
    ? groups
        .map((g) => ({
          group: g.group,
          icons: g.icons.filter(
            (i) =>
              i.label.toLowerCase().includes(search.toLowerCase()) ||
              i.name.toLowerCase().includes(search.toLowerCase()),
          ),
        }))
        .filter((g) => g.icons.length > 0)
    : groups;

  return (
    <div>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg bg-background hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
      >
        {value ? (
          <>
            <LucideIcon name={value} className="h-4 w-4 text-foreground shrink-0" />
            <span className="flex-1 text-left text-foreground">{value}</span>
            <X
              className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground shrink-0"
              onClick={handleClear}
            />
          </>
        ) : (
          <>
            <span className="flex-1 text-left text-muted-foreground">Izaberi ikonicu...</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {/* Dropdown rendered in a portal so modal overflow:hidden doesn't clip it */}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          id="icon-picker-portal"
          style={dropdownStyle}
          className="rounded-xl border border-border bg-white dark:bg-card shadow-2xl overflow-hidden flex flex-col max-h-80"
        >
          {/* Search */}
          <div className="p-2 border-b border-border shrink-0">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pretraži ikonice..."
                className="flex-1 text-sm bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Grid */}
          <div className="overflow-y-auto flex-1 p-2 space-y-3">
            {loading && (
              <p className="text-xs text-muted-foreground text-center py-4">Učitavanje...</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nije pronađeno</p>
            )}
            {filtered.map((g) => (
              <div key={g.group}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
                  {g.group}
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {g.icons.map((icon) => (
                    <button
                      key={icon.name}
                      type="button"
                      title={icon.label}
                      onClick={() => handleSelect(icon.name)}
                      className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors ${
                        value === icon.name
                          ? 'bg-primary text-white'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <LucideIcon name={icon.name} className="h-4 w-4 shrink-0" />
                      <span className="text-[9px] leading-none text-center truncate w-full">
                        {icon.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
