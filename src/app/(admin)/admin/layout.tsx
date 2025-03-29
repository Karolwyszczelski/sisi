import { supabaseServer } from '@/lib/supabaseServer';
import SidebarClient from './SidebarClient';

export const metadata = {
  title: 'Panel administracyjny',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Inicjalizacja klienta Supabase dla server component (sesja przechowywana w cookies)
  const supabase = supabaseServer();

  // Pobierz informacje o zalogowanym użytkowniku
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  let role = 'employee'; // Domyślna rola
  if (user && !error) {
    // Pobierz rolę z tabeli 'profiles' dla danego użytkownika (zakładamy, że 'profiles.id' to ten sam UID)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profileError && profile?.role) {
      role = profile.role; // 'manager' lub 'employee'
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (client component) otrzymuje rolę, aby warunkowo renderować zakładki */}
      <SidebarClient role={role} />
      <main className="flex-1 p-6 bg-gray-100">
        {children}
      </main>
    </div>
  );
}
