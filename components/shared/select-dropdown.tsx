'use client';

import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current && !triggerRef.current.contains(target)) {
        const portal = document.getElementById('select-dropdown-portal');
        if (!portal || !portal.contains(target)) {
          setOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleToggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const optionHeight = 40;
      const listHeight = Math.min(options.length * optionHeight, 240);
      const spaceBelow = window.innerHeight - rect.bottom;
      const goUp = spaceBelow < listHeight && rect.top > listHeight;
      setDropdownStyle({
        position: 'fixed',
        top: goUp ? rect.top - listHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    setOpen((p) => !p);
  }

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
          className="rounded-xl border border-border bg-white dark:bg-card shadow-lg overflow-hidden"
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
