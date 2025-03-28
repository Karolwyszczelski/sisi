import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }
  // ...
}
