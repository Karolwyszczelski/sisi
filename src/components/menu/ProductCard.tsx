"use client";

import { Plus } from "lucide-react";
import useCartStore from "@/store/cartStore";

interface Product {
  name: string;
  price: number;
  description?: string;
}

interface ProductCardProps {
  product: Product;
  index: number;
}

export default function ProductCard({ product, index }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const isFirst = index === 0;

  const handleAddToCart = () => {
    addItem({ name: product.name, price: product.price });
  };

  if (isFirst) {
    // --- PIERWSZA KARTA ---
    return (
      <div
        onClick={handleAddToCart}
        className="
          relative p-4 min-h-[220px] rounded-2xl bg-yellow-400 text-black
          transition-all duration-300 group
          hover:scale-105 hover:shadow-lg
          cursor-pointer
        "
      >
        {/* Cena w kółku (czarne tło, biała czcionka) */}
        <div
          className="
            absolute top-3 left-3 w-10 h-10 rounded-full
            flex items-center justify-center
            text-xs font-bold
            bg-black text-white
            transition-colors duration-300
            group-hover:bg-white group-hover:text-black
          "
        >
          {product.price} zł
        </div>

        {/* Przycisk „Dodaj do koszyka” w prawym dolnym rogu */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // zapobiega propagacji do całej karty
            handleAddToCart();
          }}
          className="
            absolute bottom-3 right-3 w-8 h-8 rounded-full
            flex items-center justify-center
            bg-black text-white
            transition-colors duration-300
            hover:bg-white hover:text-black
          "
          aria-label="Dodaj do koszyka"
        >
          <Plus size={16} />
        </button>

        {/* Nazwa produktu */}
        <h3 className="mt-14 text-sm font-extrabold uppercase leading-tight">
          {product.name}
        </h3>

        {/* Opis produktu */}
        {product.description && product.description.trim().length > 0 && (
          <p className="mt-1 text-xs leading-tight">
            {product.description}
          </p>
        )}
      </div>
    );
  } else {
    // --- POZOSTAŁE KARTY ---
    return (
      <div
        onClick={handleAddToCart}
        className="
          relative p-4 min-h-[220px] rounded-2xl
          bg-transparent border border-white
          transition-all duration-300 group
          hover:scale-105 hover:shadow-lg
          hover:bg-yellow-400
          text-white
          cursor-pointer
        "
      >
        {/* Cena w kółku */}
        <div
          className="
            absolute top-3 left-3 w-10 h-10 rounded-full
            flex items-center justify-center
            text-xs font-bold
            bg-black text-white
            transition-colors duration-300
            group-hover:bg-white group-hover:text-black
          "
        >
          {product.price} zł
        </div>

        {/* Przycisk „Dodaj do koszyka” (plus) w prawym dolnym rogu */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // zapobiega propagacji do całej karty
            handleAddToCart();
          }}
          className="
            absolute bottom-3 right-3 w-8 h-8 rounded-full
            flex items-center justify-center
            bg-white text-black
            transition-colors duration-300
            group-hover:bg-black group-hover:text-white
          "
          aria-label="Dodaj do koszyka"
        >
          <Plus size={16} />
        </button>

        {/* Nazwa produktu (żółta, hover -> czarna) */}
        <h3
          className="
            mt-14 text-sm font-extrabold uppercase leading-tight
            text-yellow-400 group-hover:text-black
          "
        >
          {product.name}
        </h3>

        {/* Opis produktu (biały, hover -> biały) */}
        {product.description && product.description.trim().length > 0 && (
          <p className="mt-1 text-xs leading-tight">
            {product.description}
          </p>
        )}
      </div>
    );
  }
}
