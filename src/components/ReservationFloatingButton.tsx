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
          fixed bottom-20 right-16
          w-11 h-11 bg-yellow-400 text-white
          rounded-full shadow-lg flex items-center justify-center
          hover:bg-yellow-300 transition-colors z-50
        "
        aria-label="Rezerwuj stolik"
      >
        <Calendar className="w-6 h-6" />
      </button>

      {/* Przekazujemy isOpen, aby sam modal wiedział, kiedy ma się pokazać */}
      <ReservationModal
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
