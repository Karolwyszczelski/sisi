// src/components/ReservationFloatingButton.tsx
"use client";

import { Calendar } from "lucide-react";
import { useState } from "react";
// Sprawdź, czy plik nazywa się dokładnie ReservationModal.tsx
import ReservationModal from "./ReservationModal";

export default function ReservationFloatingButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="
          fixed bottom-6 right-[152px]
          hidden md:flex
          w-11 h-11 bg-zinc-900/90 backdrop-blur-sm text-white/80
          rounded-full shadow-lg items-center justify-center
          border border-white/10 hover:border-white/20
          hover:bg-zinc-800 transition-all duration-200 z-50
        "
        aria-label="Rezerwuj stolik"
      >
        <Calendar className="w-5 h-5" />
      </button>

      {/* Przekazujemy isOpen, aby sam modal wiedział, kiedy ma się pokazać */}
      <ReservationModal
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
