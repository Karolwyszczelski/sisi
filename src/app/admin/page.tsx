// app/admin/page.tsx
import { supabaseServer } from "@/lib/supabaseServer";
import AdminPanel from "./AdminPanel/page";
import EmployeePanel from "./EmployeePanel/page";
import AdminLogin from "./login/page";

export default async function AdminPage() {
  const supabase = supabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return <AdminLogin />;
  }

  // Pobieramy profil, który zawiera rolę
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || "employee";

  return role === "admin" ? <AdminPanel /> : <EmployeePanel />;
}
