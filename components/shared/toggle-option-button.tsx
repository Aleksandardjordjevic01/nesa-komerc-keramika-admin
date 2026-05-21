'use client';

import { CheckSquare, Square, Box } from 'lucide-react';

interface ToggleOptionButtonProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  icon?: React.ReactNode;
}

export function ToggleOptionButton({ checked, onChange, label, icon }: ToggleOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 px-4 py-5 rounded-xl border-2 cursor-pointer transition-all text-left ${
        checked
          ? 'border-primary bg-primary/5'
          : 'border-border bg-background hover:bg-accent/50'
      }`}
    >
      {checked
        ? <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
        : <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      }
      {icon ?? <Box className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  );
}
