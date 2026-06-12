'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SelectDropdown({ options, value, onChange, className = '' }: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  const calcStyle = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const MAX_HEIGHT = 280;
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
    if (!open) calcStyle();
    setOpen((p) => !p);
  }

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
          className="rounded-xl border border-border bg-white dark:bg-card shadow-lg overflow-y-auto"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-xs transition-colors hover:bg-accent ${
                opt.value === value
                  ? 'text-primary font-medium bg-primary/5'
                  : 'text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
