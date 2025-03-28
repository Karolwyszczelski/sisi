import { supabase } from '@/lib/supabase';
import AdminClient from './AdminClient';
import AdminLogin from './AdminLogin';

export default async function AdminPage() {
  // 1. Pobierz informacje o zalogowanym userze
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('Błąd pobierania usera:', error);
  }

  // 2. Jeśli user jest zalogowany -> pokaż panel
  //    Jeśli nie -> pokaż formularz logowania
  if (user) {
    return <AdminClient />;
  } else {
    return <AdminLogin />;
  }
}
