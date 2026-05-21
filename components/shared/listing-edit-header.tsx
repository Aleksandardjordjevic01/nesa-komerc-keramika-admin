'use client';

import { Loader2 } from 'lucide-react';

interface ListingEditHeaderProps {
  activeStep: 1 | 2 | 3;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (e?: React.FormEvent) => void;
  onScrollTo: (section: 'kategorija' | 'identifikacija' | 'unos') => void;
}

export function ListingEditHeader({ activeStep, isSaving, onCancel, onSave, onScrollTo }: ListingEditHeaderProps) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-md px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between gap-6">
        {/* LEFT: Step indicators */}
        <div className="flex items-center gap-2 sm:gap-3">
          {activeStep === 1 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-semibold border-primary bg-primary text-primary-foreground shadow-md">
              <span>1. Kategorije</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onScrollTo('kategorija')}
              className="flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-semibold border-border bg-background text-muted-foreground hover:border-primary/50 transition-all"
            >
              1
            </button>
          )}

          {activeStep === 2 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-semibold border-primary bg-primary text-primary-foreground shadow-md">
              <span>2. Unos oglasa</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onScrollTo('unos')}
              className="flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-semibold border-border bg-background text-muted-foreground hover:border-primary/50 transition-all"
            >
              2
            </button>
          )}

          {activeStep === 3 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-semibold border-primary bg-primary text-primary-foreground shadow-md">
              <span>3. Identifikacija</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onScrollTo('identifikacija')}
              className="flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-semibold border-border bg-background text-muted-foreground hover:border-primary/50 transition-all"
            >
              3
            </button>
          )}
        </div>

        {/* RIGHT: Action buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {activeStep === 2 && (
            <button
              type="button"
              onClick={() => onScrollTo('kategorija')}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-colors"
            >
              Kategorija
            </button>
          )}
          {(activeStep === 2 || activeStep === 3) && (
            <button
              type="button"
              onClick={() => onScrollTo('identifikacija')}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-colors"
            >
              Identifikacija
            </button>
          )}
          {(activeStep === 1 || activeStep === 3) && (
            <button
              type="button"
              onClick={() => onScrollTo('unos')}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-colors"
            >
              Unos oglasa
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-colors"
          >
            Odustanite
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Čuvanje...</span>
              </>
            ) : (
              <span>Sačuvajte</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
