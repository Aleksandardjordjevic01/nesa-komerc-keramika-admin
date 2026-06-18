'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function SelectDropdown({ options, value, onChange, className = '', searchable = false, searchPlaceholder = 'Pretraži...' }: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [searchQuery, setSearchQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  const filteredOptions = searchable && searchQuery.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  const calcStyle = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const MAX_HEIGHT = 320;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const goUp = spaceBelow < MAX_HEIGHT && spaceAbove > spaceBelow;
    setDropdownStyle({
      position: 'fixed',
      top: goUp ? rect.top - Math.min(MAX_HEIGHT, spaceAbove) - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: goUp ? Math.min(MAX_HEIGHT, spaceAbove) : Math.min(MAX_HEIGHT, spaceBelow),
      zIndex: 9999,
    });
  }, []);

  function handleToggle() {
    if (!open) {
      calcStyle();
      setSearchQuery('');
    }
    setOpen((p) => !p);
  }

  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open, searchable]);

  // Reposition on scroll/resize; close if trigger scrolled out of view
  useEffect(() => {
    if (!open) return;
    function onScroll() {
      if (!triggerRef.current) return setOpen(false);
      const rect = triggerRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false);
      } else {
        calcStyle();
      }
    }
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, calcStyle]);

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const portal = document.getElementById('select-dropdown-portal');
      if (portal?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-white text-foreground text-sm hover:bg-accent/50 transition-colors"
      >
        <span>{selected?.label}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          id="select-dropdown-portal"
          style={dropdownStyle}
          className="rounded-xl border border-border bg-white dark:bg-card shadow-lg flex flex-col overflow-hidden"
        >
          {searchable && (
            <div className="p-2 border-b border-border shrink-0">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border bg-background">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">Nema rezultata.</p>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); setSearchQuery(''); }}
                  className={`w-full text-left px-4 py-2.5 text-xs transition-colors hover:bg-accent ${
                    opt.value === value
                      ? 'text-primary font-medium bg-primary/5'
                      : 'text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
