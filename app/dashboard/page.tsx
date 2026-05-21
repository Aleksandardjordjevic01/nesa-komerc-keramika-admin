'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
import { getDashboardStats, type DashboardStats, type AdminUser } from '../../lib/api/client';
import { Users, Package, ShoppingCart, MessageSquareDashed, Percent, Truck, ChevronRight } from 'lucide-react';

const QUICK_ACCESS = [
  { href: '/dashboard/narudzbine', label: 'Narudžbine', desc: 'Pregledajte i upravljajte narudžbinama', icon: ShoppingCart },
  { href: '/dashboard/proizvodi', label: 'Proizvodi', desc: 'Upravljajte katalogom proizvoda', icon: Package },
  { href: '/dashboard/reklamacije', label: 'Reklamacije', desc: 'Obradite reklamacije kupaca', icon: MessageSquareDashed },
  { href: '/dashboard/korisnici', label: 'Korisnici', desc: 'Upravljajte korisnicima', icon: Users },
];

type StatCard = { label: string; value: number; icon: React.ComponentType<{ className?: string }> };

function buildCards(stats: DashboardStats): StatCard[] {
  return [
    { label: 'Korisnika', value: stats.usersCount, icon: Users },
    { label: 'Proizvoda', value: stats.listingsCount, icon: Package },
    { label: 'Narudžbina', value: stats.messagesCount, icon: ShoppingCart },
    { label: 'Reklamacija', value: stats.reportsCount, icon: MessageSquareDashed },
  ];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const cached = localStorage.getItem('admin_user');
    if (cached) {
      try { setAdmin(JSON.parse(cached) as AdminUser); } catch { /* ignore */ }
    }
    getDashboardStats()
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Greška pri učitavanju'));
  }, []);

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">

        {/* Greeting */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Zdravo{admin ? `, ${admin.name}` : ''}
          </h1>
          {admin && <p className="text-sm text-muted-foreground mt-0.5">{admin.email}</p>}
        </div>

        {/* CTA Banner — brand-dark like web app */}
        <div className="relative overflow-hidden rounded-xl bg-brand-dark px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Pregled platforme</p>
            <p className="text-xs text-white/60 mt-0.5">
              Sve statistike i upravljanje na jednom mestu.
            </p>
          </div>
          <Link
            href="/dashboard/narudzbine"
            className="flex-shrink-0 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors"
          >
            Narudžbine →
          </Link>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
        )}

        {/* Stats */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Statistike</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats
              ? buildCards(stats).map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-card rounded-xl border border-border px-4 py-4 card-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
                  </div>
                ))
              : Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-card rounded-xl border border-border px-4 py-4 animate-pulse card-shadow">
                    <div className="h-3 bg-muted rounded w-16 mb-3" />
                    <div className="h-6 bg-muted rounded w-10" />
                  </div>
                ))}
          </div>
        </div>

        {/* Quick access */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Brzi pristup</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUICK_ACCESS.map(({ href, label, desc, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-4 bg-card rounded-xl border border-border px-5 py-4 hover:border-border hover:card-shadow-hover transition-all group card-shadow"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-accent transition-colors">
                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
