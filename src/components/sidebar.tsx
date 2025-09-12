// src/components/admin/Sidebar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  ShoppingCart,
  Clock,
  List,
  Calendar,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Star,
  Utensils,
  Sandwich,
} from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import clsx from "clsx";

type Role = "admin" | "employee" | null;
type IconLike = React.ComponentType<{ className?: string }>;

interface MenuItem {
  label: string;
  href: string;
  Icon: IconLike;
  roles: Role[];
}

const BurgerIcon: IconLike = ({ className }) => {
  const [err, setErr] = useState(false);
  if (err) return <Sandwich className={className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/burger.png" alt="" className={className} onError={() => setErr(true)} />;
};

const MENU: MenuItem[] = [
  { label: "Dashboard", href: "/admin/AdminPanel", Icon: Home, roles: ["admin", "employee"] },
  { label: "Odbierz zamówienie", href: "/admin/pickup-order", Icon: ShoppingCart, roles: ["admin", "employee"] },
  { label: "Bieżące zamówienia", href: "/admin/current-orders", Icon: Clock, roles: ["admin", "employee"] },
  { label: "Historia", href: "/admin/history", Icon: List, roles: ["admin", "employee"] },
  { label: "Rezerwacje", href: "/admin/reservations", Icon: Calendar, roles: ["admin", "employee"] },
  { label: "Menu", href: "/admin/menu", Icon: Utensils, roles: ["admin", "employee"] }, // talerz z widelcem
  { label: "Burger miesiąca", href: "/admin/burger-miesiaca", Icon: BurgerIcon, roles: ["admin"] }, // burger
  { label: "Ustawienia", href: "/admin/settings", Icon: Settings, roles: ["admin"] },
];

const STORAGE_KEY = "admin_sidebar_collapsed";

export default function Sidebar() {
  const [role, setRole] = useState<Role>(null);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname() || "";
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (v != null) setCollapsed(v === "true");
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false"); } catch {}
  }, [collapsed]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setRole(null); return; }
        const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
        setRole((data?.role as Role) ?? null);
      } catch { setRole(null); }
    })();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin");
  };

  if (role === null) {
    return (
      <aside
        className={clsx(
          "sticky top-0 z-30 h-[100dvh] bg-black text-white border-r border-gray-900 flex-none",
          "transition-[width] duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="h-full flex items-center justify-center">Ładowanie…</div>
      </aside>
    );
  }

  return (
    <aside
      className={clsx(
        "sticky top-0 z-30 h-[100dvh] bg-black text-white border-r border-gray-900 flex-none",
        "transition-[width] duration-200 will-change-[width]",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-800">
        {!collapsed && <div className="text-base font-semibold">Panel Admina</div>}
        <button
          aria-label={collapsed ? "Rozwiń panel boczny" : "Zwiń panel boczny"}
          onClick={() => setCollapsed((c) => !c)}
          className="p-1 rounded hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      {/* Scrollowane tylko menu, header i footer są pinowane */}
      <nav className="h-[calc(100dvh-3rem-3.25rem)] overflow-y-auto">
        <ul className="py-2">
          {MENU.filter((i) => i.roles.includes(role)).map(({ label, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 transition-colors",
                    "hover:bg-gray-900",
                    active && "bg-gray-900"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer: zawsze na tej samej wysokości */}
      <div className="sticky bottom-0 bg-black/95 border-t border-gray-800 px-2 py-3">
        <button
          onClick={handleLogout}
          className={clsx(
            "w-full flex items-center gap-3 rounded px-3 py-2 transition",
            "hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-500/30",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Wyloguj</span>}
        </button>
      </div>
    </aside>
  );
}
