"use client";

import { useMemo, useState } from "react";
import { Plus, Check } from "lucide-react";
import useCartStore from "@/store/cartStore";

interface Product {
  name: string;
  price: number;
  description?: string;
  ingredients?: string[] | string | null;
}

interface ProductCardProps {
  product: Product;
  index: number;
}

function parseIngredients(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return parseIngredients(parsed);
    } catch {
      return s.split(",").map((x) => x.trim()).filter(Boolean);
    }
  }
  if (typeof v === "object") {
    if (Array.isArray((v as any).items)) return parseIngredients((v as any).items);
    return Object.values(v).map(String).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export default function ProductCard({ product, index }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const isFirst = index === 0;
  const [added, setAdded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const ing = useMemo(() => parseIngredients(product.ingredients), [product.ingredients]);
  const bodyText = useMemo(() => {
    if (ing.length) return ing.join(" · ");
    return (product.description ?? "").trim();
  }, [ing, product.description]);

  // Sprawdź czy tekst jest dłuższy niż 3 linie (około 80 znaków)
  const isLongText = bodyText.length > 80;

  const handleAddToCart = () => {
    addItem({ name: product.name, price: product.price });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div
      onClick={handleAddToCart}
      className={`
        group relative cursor-pointer h-full
        rounded-3xl overflow-hidden
        transition-all duration-500 ease-out
        ${isFirst 
          ? "bg-gradient-to-br from-yellow-400 via-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/20 hover:shadow-2xl hover:shadow-yellow-500/30 hover:-translate-y-2" 
          : "bg-gradient-to-br from-zinc-800/90 to-zinc-900 border border-white/5 hover:border-yellow-400/40 hover:-translate-y-2 hover:shadow-xl hover:shadow-yellow-400/10"
        }
      `}
    >
      {/* Świecący akcent na górze przy hover */}
      {!isFirst && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      )}

      {/* Główna zawartość */}
      <div className="relative p-6 flex flex-col h-full min-h-[220px]">
        
        {/* Górna część - nazwa i badge */}
        <div className="flex-1 text-center">
          {isFirst && (
            <span className="inline-block bg-black text-yellow-400 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full mb-3">
              HIT
            </span>
          )}
          <h3 className={`
            text-lg font-extrabold uppercase tracking-tight leading-tight
            transition-colors duration-300
            ${isFirst ? "text-black" : "text-white group-hover:text-yellow-400"}
          `}>
            {product.name}
          </h3>
          
          {/* Składniki */}
          {bodyText && (
            <div className="mt-3">
              <p className={`
                text-[13px] leading-relaxed
                ${expanded ? "" : "line-clamp-2"}
                ${isFirst ? "text-black/50" : "text-white/40"}
              `}>
                {bodyText}
              </p>
              {isLongText && (
                <button
                  type="button"
                  onClick={toggleExpand}
                  className={`
                    mt-1.5 text-[11px] font-semibold
                    ${isFirst ? "text-black/70 hover:text-black" : "text-yellow-400/80 hover:text-yellow-400"}
                    transition-colors
                  `}
                >
                  {expanded ? "Zwiń ▲" : "Więcej ▼"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dolna część - cena i przycisk */}
        <div className={`
          flex items-end justify-between mt-5 pt-4
          ${isFirst ? "border-t border-black/10" : "border-t border-white/5"}
        `}>
          <div className="flex items-baseline gap-1">
            <span className={`
              text-3xl font-black tracking-tight
              ${isFirst ? "text-black" : "text-white"}
            `}>
              {product.price}
            </span>
            <span className={`
              text-base font-semibold
              ${isFirst ? "text-black/40" : "text-white/30"}
            `}>
              zł
            </span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleAddToCart(); }}
            className={`
              relative w-12 h-12 rounded-2xl flex items-center justify-center
              transition-all duration-300
              ${isFirst 
                ? "bg-black text-yellow-400 hover:scale-110 hover:rotate-3" 
                : "bg-yellow-400 text-black hover:scale-110 hover:rotate-3 hover:bg-yellow-300"
              }
              ${added ? "scale-110 rotate-12" : ""}
            `}
            aria-label="Dodaj do koszyka"
            type="button"
          >
            <div className={`transition-all duration-300 ${added ? "scale-0" : "scale-100"}`}>
              <Plus size={22} strokeWidth={2.5} />
            </div>
            <div className={`absolute transition-all duration-300 ${added ? "scale-100" : "scale-0"}`}>
              <Check size={22} strokeWidth={3} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
