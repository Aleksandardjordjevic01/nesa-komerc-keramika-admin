'use client';

import { Check } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 transition-all"
    >
      <div
        className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          checked ? 'border-primary bg-primary' : 'border-border bg-card'
        }`}
      >
        {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
      </div>
      <span className="text-sm text-foreground">{label}</span>
    </button>
  );
}
