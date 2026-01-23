// src/app/admin/burger-month/page.tsx
"use client";

import React from "react";
import BurgerMonthForm from "@/components/admin/settings/BurgerMonthForm";

export default function BurgerMonthPage() {
  return (
    <main className="flex-1 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <BurgerMonthForm />
      </div>
    </main>
  );
}
