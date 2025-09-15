import Sidebar from "@/components/sidebar";
import CookieBanner from "@/components/CookieBanner";
//…
export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <CookieBanner />
      <main className="flex-1 bg-gray-50 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
