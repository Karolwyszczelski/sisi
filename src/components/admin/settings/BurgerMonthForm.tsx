"use client";

import Link from "next/link";

// Keep legacy settings entry points on the same editor and transactional save.
export default function BurgerMonthForm() {
  return <Link href="/admin/burger-miesiaca" className="text-amber-600 underline">Edytuj burgera miesiąca — nazwę edycji, cenę i zdjęcie</Link>;
}
