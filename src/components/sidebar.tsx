// src/components/sidebar.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
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
  Utensils,
  Sandwich,
  User,
  Shield,
  PlusCircle,
  Menu,
  X,
} from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useTheme } from "@/components/admin/ThemeContext";

type Role = "admin" | "employee" | null;
type IconLike = React.ComponentType<{ className?: string }>;

interface MenuItem {
  label: string;
  href: string;
  Icon: IconLike;
  roles: Role[];
  badge?: string;
}

const BurgerIcon: IconLike = ({ className }) => {
  const [err, setErr] = useState(false);
  if (err) return <Sandwich className={className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/burger.png" alt="" className={className} onError={() => setErr(true)} />;
};

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: "Główne",
    items: [
      { label: "Dashboard", href: "/admin/AdminPanel", Icon: Home, roles: ["admin", "employee"] },
    ],
  },
  {
    title: "Zamówienia",
    items: [
      { label: "Odbierz zamówienie", href: "/admin/pickup-order", Icon: ShoppingCart, roles: ["admin", "employee"] },
      { label: "Bieżące zamówienia", href: "/admin/current-orders", Icon: Clock, roles: ["admin", "employee"] },
      { label: "Historia", href: "/admin/history", Icon: List, roles: ["admin", "employee"] },
    ],
  },
  {
    title: "Zarządzanie",
    items: [
      { label: "Rezerwacje", href: "/admin/reservations", Icon: Calendar, roles: ["admin", "employee"] },
      { label: "Menu", href: "/admin/menu", Icon: Utensils, roles: ["admin", "employee"] },
      { label: "Dodatki", href: "/admin/addons", Icon: PlusCircle, roles: ["admin"] },
      { label: "Burger miesiąca", href: "/admin/burger-miesiaca", Icon: BurgerIcon, roles: ["admin"] },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Ustawienia", href: "/admin/settings", Icon: Settings, roles: ["admin"] },
    ],
  },
];

const STORAGE_KEY = "admin_sidebar_collapsed";

export default function Sidebar() {
  const { isDark } = useTheme();
  const [role, setRole] = useState<Role>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  
  // Desktop: collapsed state
  const [collapsed, setCollapsed] = useState<boolean>(true);
  
  // Mobile: drawer open state
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Detect if mobile
  const [isMobile, setIsMobile] = useState(false);

  const pathname = usePathname() || "";
  const router = useRouter();
  const supabase = createClientComponentClient();

  // Check screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load collapsed state from localStorage (desktop only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved != null) {
        setCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  // Save collapsed state
  useEffect(() => {
    if (typeof window === "undefined" || isMobile) return;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false");
    } catch {}
  }, [collapsed, isMobile]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Fetch user role and listen for auth state changes
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { 
          setRole(null); 
          setLoading(false);
          return; 
        }
        setUserEmail(session.user.email || "");
        const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
        setRole((data?.role as Role) ?? null);
        setLoading(false);
      } catch {
        setRole(null);
        setLoading(false);
      }
    };

    fetchRole();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUserEmail(session.user.email || "");
        const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
        setRole((data?.role as Role) ?? null);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setRole(null);
        setUserEmail("");
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin");
  };

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const filteredSections = MENU_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);

  // ===================== MOBILE HEADER =====================
  const MobileHeader = () => (
    <header
      className={`lg:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b ${
        isDark ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"
      }`}
    >
      <button
        onClick={toggleMobile}
        className={`p-2 -ml-2 rounded-lg transition-colors ${
          isDark ? "hover:bg-slate-800 text-white" : "hover:bg-gray-100 text-gray-900"
        }`}
        aria-label="Menu"
      >
        <Menu className="h-6 w-6" />
      </button>
      
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <span className="text-white font-bold text-xs">SS</span>
        </div>
        <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>SiSi Burger</span>
      </div>
      
      <div className="w-10" /> {/* Spacer for balance */}
    </header>
  );

  // ===================== SIDEBAR CONTENT =====================
  const SidebarContent = ({ isDrawer = false }: { isDrawer?: boolean }) => (
    <div className={`flex flex-col h-full ${isDark ? "bg-slate-900" : "bg-white"}`}>
      {/* Logo / Header */}
      <div className={`flex items-center border-b h-16 px-4 ${
        isDark ? "border-slate-800/60" : "border-gray-200"
      } ${!isDrawer && collapsed ? "justify-center" : "justify-between"}`}>
        {(isDrawer || !collapsed) && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-white font-bold text-sm">SS</span>
            </div>
            <div>
              <h1 className={`text-base font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>SiSi Burger</h1>
              <p className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>Panel Admina</p>
            </div>
          </div>
        )}
        {!isDrawer && collapsed && (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-white font-bold text-sm">SS</span>
          </div>
        )}
        {isDrawer && (
          <button
            onClick={() => setMobileOpen(false)}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-gray-100 text-gray-500"
            }`}
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3">
        {filteredSections.map((section, idx) => (
          <div key={section.title} className={idx > 0 ? "mt-6" : ""}>
            {(isDrawer || !collapsed) && (
              <h2 className={`px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider ${
                isDark ? "text-slate-500" : "text-gray-400"
              }`}>
                {section.title}
              </h2>
            )}
            {!isDrawer && collapsed && idx > 0 && (
              <div className={`border-t my-3 mx-2 ${isDark ? "border-slate-800/60" : "border-gray-100"}`} />
            )}
            <ul className="space-y-1">
              {section.items.map(({ label, href, Icon, badge }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => isDrawer && setMobileOpen(false)}
                      className={`group flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                        !isDrawer && collapsed ? "justify-center px-0" : ""
                      } ${
                        active 
                          ? "bg-gradient-to-r from-amber-500/10 to-orange-500/5 text-amber-500 border-l-2 border-amber-500 -ml-[2px] pl-[14px]" 
                          : isDark 
                            ? "text-slate-400 hover:text-white hover:bg-slate-800/70" 
                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                      title={!isDrawer && collapsed ? label : undefined}
                    >
                      <Icon className={`h-5 w-5 flex-shrink-0 transition-colors ${
                        active 
                          ? "text-amber-500" 
                          : isDark 
                            ? "text-slate-500 group-hover:text-slate-300" 
                            : "text-gray-400 group-hover:text-gray-600"
                      }`} />
                      {(isDrawer || !collapsed) && (
                        <>
                          <span className="truncate text-sm font-medium">{label}</span>
                          {badge && (
                            <span className="ml-auto bg-amber-500/20 text-amber-500 text-xs font-medium px-2 py-0.5 rounded-full">
                              {badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User Profile & Logout */}
      <div className={`border-t p-3 ${isDark ? "border-slate-800/60" : "border-gray-200"}`}>
        {/* User info */}
        <div className={`flex items-center gap-3 px-2 py-2 mb-2 rounded-lg ${
          isDark ? "bg-slate-800/40" : "bg-gray-100"
        } ${!isDrawer && collapsed ? "justify-center px-0" : ""}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            role === "admin" 
              ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-500" 
              : "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-500"
          }`}>
            {role === "admin" ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
          </div>
          {(isDrawer || !collapsed) && (
            <div className="overflow-hidden">
              <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                {role === "admin" ? "Administrator" : "Pracownik"}
              </p>
              <p className={`text-xs truncate ${isDark ? "text-slate-500" : "text-gray-400"}`}>{userEmail}</p>
            </div>
          )}
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 rounded-lg px-3 py-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/30 ${
            isDark 
              ? "text-slate-400 hover:text-red-400 hover:bg-red-500/10" 
              : "text-gray-500 hover:text-red-500 hover:bg-red-50"
          } ${!isDrawer && collapsed ? "justify-center px-0" : ""}`}
          title={!isDrawer && collapsed ? "Wyloguj" : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {(isDrawer || !collapsed) && <span className="text-sm font-medium">Wyloguj się</span>}
        </button>
      </div>
    </div>
  );

  // ===================== LOADING STATE =====================
  if (loading) {
    return (
      <>
        {/* Mobile Header */}
        <MobileHeader />

        {/* Mobile Drawer Overlay - even in loading state */}
        {mobileOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Mobile Drawer - loading skeleton */}
        <aside
          className={`lg:hidden fixed top-0 left-0 z-50 h-[100dvh] w-72 transform transition-transform duration-300 ease-in-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          } ${isDark ? "bg-slate-900 border-r border-slate-800" : "bg-white border-r border-gray-200"}`}
        >
          <div className="flex flex-col h-full p-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <span className="text-white font-bold text-sm">SS</span>
                </div>
                <div>
                  <div className={`h-4 w-20 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"} animate-pulse`} />
                  <div className={`h-3 w-16 mt-1 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"} animate-pulse`} />
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-gray-100 text-gray-500"
                }`}
                aria-label="Zamknij"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-10 rounded-lg ${isDark ? "bg-slate-800" : "bg-gray-100"} animate-pulse`} />
              ))}
            </div>
          </div>
        </aside>
        
        {/* Desktop Sidebar - loading */}
        <aside
          className={`hidden lg:flex sticky top-0 z-30 h-[100dvh] border-r flex-none transition-[width] duration-300 ease-in-out ${
            collapsed ? "w-[72px]" : "w-72"
          } ${isDark ? "bg-slate-900 border-slate-800/60" : "bg-white border-gray-200"}`}
        >
          <div className="h-full w-full flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />
              {!collapsed && <div className={`w-24 h-4 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />}
            </div>
          </div>
        </aside>
      </>
    );
  }

  // ===================== RENDER =====================
  return (
    <>
      {/* Mobile Header - always visible on mobile */}
      <MobileHeader />

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-[100dvh] w-72 transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${isDark ? "border-r border-slate-800" : "border-r border-gray-200"}`}
      >
        <SidebarContent isDrawer />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex sticky top-0 z-30 h-[100dvh] border-r flex-none transition-[width] duration-300 ease-in-out will-change-[width] flex-col ${
          collapsed ? "w-[72px]" : "w-72"
        } ${isDark ? "bg-slate-900 border-slate-800/60" : "bg-white border-gray-200"}`}
      >
        <SidebarContent />
        
        {/* Desktop Toggle Button */}
        <button
          aria-label={collapsed ? "Rozwiń panel boczny" : "Zwiń panel boczny"}
          onClick={() => setCollapsed((c) => !c)}
          className={`absolute -right-3 top-20 w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-200 shadow-lg z-50 ${
            isDark 
              ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700" 
              : "bg-white border-gray-300 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>
    </>
  );
}
