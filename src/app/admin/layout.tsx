import Sidebar from "@/components/sidebar";
import CookieBanner from "@/components/CookieBanner";
import { ThemeProvider } from "@/components/admin/ThemeContext";
import type { Metadata, Viewport } from "next";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Wymuszenie dynamicznego renderowania - nie pre-renderować podczas build
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel Administracyjny | SiSi Burger",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();

  // Pobierz rolę użytkownika jeśli zalogowany
  let isAuthenticated = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAuthenticated = profile?.role === "admin" || profile?.role === "employee";
  }

  // Jeśli niezalogowany - nie pokazuj sidebar (tylko login page)
  if (!isAuthenticated) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-slate-900">
          <CookieBanner />
          {children}
        </div>
      </ThemeProvider>
    );
  }

  // Zalogowany - pełny layout z sidebar
  return (
    <ThemeProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <CookieBanner />
        {/* pt-14 na mobile dla fixed header (MobileHeader z sidebar), lg:pt-0 na desktop */}
        <main className="flex-1 min-h-screen overflow-x-hidden pt-14 lg:pt-0">
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
