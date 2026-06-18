'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Package,
  Tag,
  ShoppingCart,
  MessageSquareDashed,
  Percent,
  Truck,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  BarChart2,
  SlidersHorizontal,
  Upload,
  Building2,
  FileText,
} from 'lucide-react';
import { adminLogout, adminMe, type AdminUser } from '../../lib/api/client';
import { BrandLogo } from '../shared/brand-logo';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Kontrolna tabla', icon: LayoutDashboard },
  { href: '/dashboard/narudzbine', label: 'Narudžbine', icon: ShoppingCart },
  { href: '/dashboard/proizvodi', label: 'Proizvodi', icon: Package },
  { href: '/dashboard/atributi', label: 'Atributi', icon: SlidersHorizontal },
  { href: '/dashboard/uvoz', label: 'Uvoz', icon: Upload },
  { href: '/dashboard/kategorije', label: 'Kategorije', icon: Tag },
  { href: '/dashboard/brendovi', label: 'Brendovi', icon: Building2 },
  { href: '/dashboard/korisnici', label: 'Korisnici', icon: Users },
  { href: '/dashboard/reklamacije', label: 'Reklamacije', icon: MessageSquareDashed },
  { href: '/dashboard/kuponi', label: 'Kuponi', icon: Percent },
  { href: '/dashboard/dostava', label: 'Dostava', icon: Truck },
  { href: '/dashboard/racuni', label: 'Računi', icon: FileText },
  { href: '/dashboard/analitika', label: 'Analitika', icon: BarChart2 },
];

const BOTTOM_NAV = [
  { href: '/dashboard/podesavanja', label: 'Podešavanja', icon: Settings },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    const cached = localStorage.getItem('admin_user');
    if (cached) {
      try { setAdmin(JSON.parse(cached) as AdminUser); } catch { /* ignore */ }
    }

    adminMe()
      .then((me) => {
        setAdmin(me);
        localStorage.setItem('admin_user', JSON.stringify(me));
      })
      .catch(() => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        router.replace('/login');
      });
  }, [router]);

  async function handleLogout() {
    await adminLogout();
    router.push('/login');
  }

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Top header — full width, matches web app navbar (light variant) ── */}
      <header className="sticky top-0 z-50 w-full bg-card border-b border-border">
        <div className="w-full px-4 sm:px-6">
          <div className="flex h-20 items-center justify-between gap-4">
            {/* Mobile hamburger + Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen((p) => !p)}
                className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Toggle menu"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <Link href="/dashboard" className="flex-shrink-0">
                <BrandLogo variant="color" height={22} width={90} className="sm:hidden text-xl font-light tracking-tight text-foreground" />
                <BrandLogo variant="color" height={32} width={130} className="hidden sm:block text-xl font-light tracking-tight text-foreground" />
              </Link>
            </div>

            {/* Right: Avatar */}
            <div className="flex items-center gap-2">
              {/* Avatar / User menu */}
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => setUserMenuOpen((p) => !p)}
                  aria-label="User menu"
                  className="flex items-center justify-center h-9 w-9 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors overflow-hidden"
                >
                  {admin.name.charAt(0).toUpperCase()}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-11 z-50 w-52 bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-medium text-foreground truncate">{admin.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                    </div>
                    <Link
                      href="/dashboard/podesavanja"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      Podešavanja
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors border-t border-border"
                    >
                      <LogOut className="h-4 w-4" />
                      Odjavi se
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Below header: sidebar + content ── */}
      <div className="flex flex-1 min-h-0">
        {/* Mobile overlay */}
        {sidebarOpen && pathname !== '/dashboard/poruke' && (
          <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        {pathname !== '/dashboard/poruke' && (
        <aside className={`fixed top-20 left-0 z-30 w-64 h-[calc(100vh-5rem)] bg-card border-r border-border flex flex-col transition-transform duration-200 lg:translate-x-0 lg:sticky lg:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Section label */}
          <div className="px-5 pt-5 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admin Panel
            </p>
          </div>

          {/* Main nav */}
          <nav className="flex-1 overflow-y-auto py-2">
            <ul className="px-2 space-y-0.5">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mx-4 my-2 border-t border-border" />

            <ul className="px-2 space-y-0.5">
              {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
