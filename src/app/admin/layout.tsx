import Sidebar from "@/components/sidebar";
//…
export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 bg-gray-50 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
