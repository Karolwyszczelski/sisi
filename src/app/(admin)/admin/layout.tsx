// app/(admin)/admin/layout.tsx
export const metadata = {
  title: 'Panel administracyjny',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-gray-100">
        {/* Brak globalnego headera */}
        {children}
      </body>
    </html>
  );
}
