"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { key: string; heading: string; items: NavItem[] };

/** Dashboard stays top-level and directly accessible. */
const DASHBOARD: NavItem = { href: "/", label: "Dashboard", icon: "📊" };

/**
 * Grouped modules in the required order: Burlays Restaurant, then Delivery,
 * then Settings. Restaurant and Delivery modules are kept strictly separate.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    key: "restaurant",
    heading: "Burlays Restaurant",
    items: [
      { href: "/restaurant/pos", label: "POS", icon: "🧾" },
      { href: "/restaurant/orders", label: "Restaurant Orders", icon: "📋" },
    ],
  },
  {
    key: "delivery",
    heading: "Delivery",
    items: [
      { href: "/riders", label: "Riders", icon: "🏍️" },
      { href: "/locations", label: "Locations", icon: "📍" },
      { href: "/orders/new", label: "Assign Order", icon: "➕" },
      { href: "/orders", label: "Orders", icon: "📦" },
      { href: "/reports", label: "Rider Reports", icon: "📅" },
      { href: "/advances", label: "Advances / Ledger", icon: "💰" },
    ],
  },
  {
    key: "settings",
    heading: "Settings",
    items: [
      { href: "/restaurant", label: "Burlays Settings", icon: "⚙️" },
      { href: "/profile", label: "My Profile", icon: "👤" },
    ],
  },
];

const ALL_ITEMS: NavItem[] = [DASHBOARD, ...NAV_GROUPS.flatMap((g) => g.items)];

/**
 * Resolves the single nav item matching the current pathname.
 *
 * A naive `startsWith` is ambiguous for overlapping routes — "/orders/new" also
 * starts with "/orders", and "/restaurant/pos" also starts with "/restaurant".
 * We collect every proper match (exact, or a real sub-path segment) and keep the
 * most specific one, guaranteeing exactly one highlighted item and never
 * highlighting an unrelated sibling.
 */
function getActiveHref(pathname: string, items: NavItem[]): string | null {
  const matches = items.filter(({ href }) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, cur) => (cur.href.length > best.href.length ? cur : best)).href;
}

export default function AppShell({ children, adminName }: { children: ReactNode; adminName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const activeHref = useMemo(() => getActiveHref(pathname, ALL_ITEMS), [pathname]);
  const isActive = (href: string) => href === activeHref;

  const linkClass = (href: string) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive(href) ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"
    }`;

  const logout = async () => {
    await fetch("/api/admin-auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-slate-50">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xl">🍕</span>
          <span className="text-base font-semibold text-slate-900">Burlays</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-md border border-slate-300 p-2 text-slate-700"
          aria-label="Toggle menu"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 w-64 transform overflow-y-auto border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:static md:flex md:flex-col`}
      >
        <div className="hidden items-center gap-2 border-b border-slate-200 px-6 py-5 md:flex">
          <span className="text-2xl">🍕</span>
          <div>
            <p className="text-base font-bold text-slate-900">Burlays</p>
            <p className="text-xs text-slate-500">Restaurant Management</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-3 pt-20 pb-4 md:pt-4">
          {/* 1. Dashboard */}
          <Link href={DASHBOARD.href} onClick={() => setOpen(false)} className={linkClass(DASHBOARD.href)}>
            <span className="text-lg">{DASHBOARD.icon}</span>
            {DASHBOARD.label}
          </Link>

          {/* 2. Burlays Restaurant · 3. Delivery · 4. Settings */}
          {NAV_GROUPS.map((group) => {
            const isCollapsed = collapsed[group.key];
            return (
              <div key={group.key} className="mt-3">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !c[group.key] }))}
                  className="flex w-full items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
                >
                  {group.heading}
                  <span className="text-[10px]">{isCollapsed ? "▸" : "▾"}</span>
                </button>

                {!isCollapsed && (
                  <div className="mt-1 flex flex-col gap-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={linkClass(item.href)}
                      >
                        <span className="text-lg">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}

                    {/* Logout sits at the end of Settings */}
                    {group.key === "settings" && (
                      <button
                        onClick={logout}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                      >
                        <span className="text-lg">🚪</span>
                        Logout
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {adminName && (
            <p className="mt-4 border-t border-slate-100 px-3 pt-3 text-xs text-slate-400">
              Signed in as {adminName}
            </p>
          )}
        </nav>
      </aside>

      {open && <div className="fixed inset-0 z-10 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}

      <main className="min-h-screen min-w-0 flex-1 px-4 pb-16 pt-20 md:px-8 md:pt-8">{children}</main>
    </div>
  );
}
