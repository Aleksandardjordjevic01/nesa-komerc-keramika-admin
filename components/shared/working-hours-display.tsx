'use client';

import { useEffect, useState } from 'react';
import { getWorkingHoursDisplay, type WorkingHoursDisplayRow } from '../../lib/api/client';

interface WorkingHoursDisplayProps {
  /** Pass rows directly (e.g. from SSR fetch). If omitted, fetches client-side. */
  rows?: WorkingHoursDisplayRow[];
  className?: string;
}

export function WorkingHoursDisplay({ rows: rowsProp, className = '' }: WorkingHoursDisplayProps) {
  const [rows, setRows] = useState<WorkingHoursDisplayRow[]>(rowsProp ?? []);
  const [loading, setLoading] = useState(!rowsProp);

  useEffect(() => {
    if (rowsProp) return;
    getWorkingHoursDisplay()
      .then(setRows)
      .finally(() => setLoading(false));
  }, [rowsProp]);

  return (
    <div className={`text-sm ${className}`}>
      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">
        Radno vreme
      </p>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.days} className="flex items-baseline justify-between gap-6">
              <span className="text-foreground/80">{row.days}</span>
              <span className={row.isOpen ? 'text-foreground font-medium tabular-nums' : 'text-muted-foreground'}>
                {row.hours}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
