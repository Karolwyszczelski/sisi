import { supabaseServer } from '@/lib/supabaseServer';
import AdminLogin from './AdminLogin';
import AdminClient from './AdminClient';
import EmployeeClient from './EmployeeClient';

export default async function AdminPage() {
  const supabase = supabaseServer();

  // Pobieramy dane o zalogowanym użytkowniku
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('Błąd pobierania usera:', error);
  }

  // Jeśli nie ma zalogowanego użytkownika, wyświetlamy formularz logowania
  if (!user) {
    return <AdminLogin />;
  }

  // Pobieramy profil użytkownika (jego rolę) z tabeli 'profiles'
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Błąd pobierania profilu:', profileError);
    // W przypadku błędu traktujemy użytkownika jako pracownika
    return <EmployeeClient />;
  }

  const role = profile?.role || 'employee';

  // Jeśli użytkownik ma rolę 'manager', wyświetlamy panel administratora,
  // w przeciwnym razie (employee) wyświetlamy panel pracownika.
  return role === 'manager' ? <AdminClient /> : <EmployeeClient />;
}
