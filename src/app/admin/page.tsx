// src/app/admin/page.tsx
import { supabaseServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import AdminLogin from "./login/page";

export default async function AdminEntry() {
  const supabase = supabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();

  // 1. Jeśli niezalogowany → pokazujemy ekran logowania
  if (error || !user) {
    return <AdminLogin />;
  }

  // 2. Pobieramy profil (rolę)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = profile?.role;

  // 3. Przekierowujemy wg roli:
  if (role === "admin") {
    redirect("/admin/AdminPanel");
  }
  if (role === "employee") {
    redirect("/admin/EmployeePanel");
  }

  // 4. Na wszelki wypadek zablokuj klienta
  redirect("/");
}
