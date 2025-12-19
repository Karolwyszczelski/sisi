"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import useCartStore from "@/store/cartStore";

interface Product {
  name: string;
  price: number;
  description?: string;
  // skład może przyjść jako tablica lub string (czasem JSON-string)
  ingredients?: string[] | string | null;
}

interface ProductCardProps {
  product: Product;
  index: number;
}

function parseIngredients(v: any): string[] {
  if (!v) return [];

  // tablica
  if (Array.isArray(v)) {
    return v.map(String).map((s) => s.trim()).filter(Boolean);
  }

  // string: może być CSV albo JSON
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];

    // JSON array/object
    try {
      const parsed = JSON.parse(s);
      return parseIngredients(parsed);
    } catch {
      // CSV fallback
      return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }

  // obiekt (np. { items: [...] } albo {0:"a",1:"b"})
  if (typeof v === "object") {
    if (Array.isArray((v as any).items)) return parseIngredients((v as any).items);
    return Object.values(v).map(String).map((s) => s.trim()).filter(Boolean);
  }

  return [];
}

export default function ProductCard({ product, index }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const isFirst = index === 0;

  const [expanded, setExpanded] = useState(false);

  const ing = useMemo(() => parseIngredients(product.ingredients), [product.ingredients]);
  const bodyText = useMemo(() => {
    if (ing.length) return ing.join(", ");
    return (product.description ?? "").trim();
  }, [ing, product.description]);

  // heurystyka: pokaż przełącznik jeśli tekst raczej będzie ucinany
  const canExpand = useMemo(() => {
    if (!bodyText) return false;
    return bodyText.length > 90 || ing.length > 6;
  }, [bodyText, ing.length]);

  const handleAddToCart = () => {
    addItem({ name: product.name, price: product.price });
  };

  const toggleBtnClass = isFirst
    ? "mt-2 text-[11px] font-semibold text-black/70 hover:text-black"
    : "mt-2 text-[11px] font-semibold text-white/80 hover:text-white group-hover:text-black/70";

  const textClass = isFirst
    ? "mt-1 text-xs leading-tight text-black"
    : "mt-1 text-xs leading-tight text-white group-hover:text-black";

  const priceBubbleClass = isFirst
    ? "absolute top-3 left-3 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold bg-black text-white transition-colors duration-300 group-hover:bg-white group-hover:text-black"
    : "absolute top-3 left-3 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold bg-black text-white transition-colors duration-300 group-hover:bg-white group-hover:text-black";

  const plusBtnClass = isFirst
    ? "absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-black text-white transition-colors duration-300 hover:bg-white hover:text-black"
    : "absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-white text-black transition-colors duration-300 group-hover:bg-black group-hover:text-white";

  // ====== RENDER: pierwsza karta ======
  if (isFirst) {
    return (
      <div
        onClick={handleAddToCart}
        className="
          relative p-4 min-h-[220px] rounded-2xl bg-yellow-400 text-black
          transition-all duration-300 group hover:scale-105 hover:shadow-lg
          cursor-pointer h-full flex flex-col
        "
      >
        <div className={priceBubbleClass}>{product.price} zł</div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAddToCart();
          }}
          className={plusBtnClass}
          aria-label="Dodaj do koszyka"
          type="button"
        >
          <Plus size={16} />
        </button>

        <h3 className="mt-14 text-sm font-extrabold uppercase leading-tight">{product.name}</h3>

        {bodyText && (
          <>
            <p
              className={`${textClass} ${
                expanded ? "max-h-28 overflow-auto pr-1" : "line-clamp-3"
              }`}
            >
              {bodyText}
            </p>

            {canExpand && (
              <button
                type="button"
                className={toggleBtnClass}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
              >
                {expanded ? "Zwiń" : "Więcej"}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // ====== RENDER: pozostałe karty ======
  return (
    <div
      onClick={handleAddToCart}
      className="
        relative p-4 min-h-[220px] rounded-2xl bg-transparent border border-white
        transition-all duration-300 group hover:scale-105 hover:shadow-lg hover:bg-yellow-400
        text-white cursor-pointer h-full flex flex-col
      "
    >
      <div className={priceBubbleClass}>{product.price} zł</div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleAddToCart();
        }}
        className={plusBtnClass}
        aria-label="Dodaj do koszyka"
        type="button"
      >
        <Plus size={16} />
      </button>

      <h3
        className="
          mt-14 text-sm font-extrabold uppercase leading-tight
          text-yellow-400 group-hover:text-black
        "
      >
        {product.name}
      </h3>

      {bodyText && (
        <>
          <p
            className={`${textClass} ${
              expanded ? "max-h-28 overflow-auto pr-1" : "line-clamp-3"
            }`}
          >
            {bodyText}
          </p>

          {canExpand && (
            <button
              type="button"
              className={toggleBtnClass}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? "Zwiń" : "Więcej"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
