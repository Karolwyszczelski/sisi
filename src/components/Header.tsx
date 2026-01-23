"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, Phone } from "lucide-react";
import clsx from "clsx";

export default function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onKeyDown]);

  return (
    <header className={clsx("fixed inset-x-0 top-0 z-50", "bg-transparent")} role="banner">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" aria-label="Strona główna" className="flex items-center gap-2">
          <Image src="/logo.png" alt="SISI Logo" width={70} height={70} priority />
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-5 text-sm md:flex">
          <Link href="/#menu" className="text-white hover:text-yellow-400 transition">Menu</Link>
          <Link href="/polityka-prywatnosci" className="text-white hover:text-yellow-400 transition">Polityka Prywatności</Link>
          <Link href="/regulamin" className="text-white hover:text-yellow-400 transition">Regulamin</Link>
          <a
            href="tel:+48515433488"
            className="flex items-center rounded px-3 py-2 font-bold bg-black text-yellow-400 hover:opacity-90 transition"
          >
            <Phone className="mr-2 h-5 w-5" />
            515 433 488
          </a>
        </nav>

        {/* Hamburger */}
        <button
          type="button"
          className="text-white md:hidden"
          aria-label="Otwórz menu"
          aria-expanded={open}
          aria-controls="mobile-drawer"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-7 w-7" />
        </button>
      </div>

      {/* Drawer */}
      <aside
        id="mobile-drawer"
        className={clsx(
          "fixed right-0 top-0 z-50 h-full w-80 max-w-[85%]",
          "translate-x-full transition-transform duration-300 ease-out",
          "bg-yellow-400 text-white shadow-xl md:hidden"
        )}
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2">
            <Image src="/logo.png" alt="SISI Logo" width={40} height={40} />
            <span className="text-base font-semibold">SISI</span>
          </Link>
          <button type="button" aria-label="Zamknij menu" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-black/5">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-4 py-4 text-base">
          <Link href="/#menu" className="rounded px-3 py-2 hover:bg-black/5" onClick={() => setOpen(false)}>Menu</Link>
          <Link href="/polityka-prywatnosci" className="rounded px-3 py-2 hover:bg-black/5" onClick={() => setOpen(false)}>Polityka Prywatności</Link>
          <Link href="/regulamin" className="rounded px-3 py-2 hover:bg-black/5" onClick={() => setOpen(false)}>Regulamin</Link>
          <a
            href="tel:+48515433488"
            className="mt-2 w-fit rounded bg-black px-3 py-2 font-bold text-yellow-400 hover:opacity-90"
            onClick={() => setOpen(false)}
          >
            <Phone className="mr-2 inline-block h-5 w-5 align-[-2px]" />
            515 433 488
          </a>
        </nav>
      </aside>
    </header>
  );
}
