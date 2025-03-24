'use client';

import { Plus } from 'lucide-react';
import useCartStore from '@/store/cartStore'; // 👈 Dodaj import

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
  const isFirst = index === 0;
  const addItem = useCartStore((state) => state.addItem); // 👈 Hook do dodawania produktu

  const handleAddToCart = () => {
    addItem({
      name: product.name,
      price: product.price,
    });
  };

  return (
    <div
      className={`
        relative p-6 rounded-2xl border transition-all duration-300 group min-h-[160px]
        ${isFirst
          ? 'bg-yellow-400 text-black border-none'
          : 'bg-transparent text-yellow-400 border-white hover:bg-yellow-400 hover:text-white'}
      `}
    >
      {/* Dodaj do koszyka */}
      <button
        onClick={handleAddToCart}
        className={`
          absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center
          ${isFirst ? 'bg-black text-yellow-400' : 'bg-white text-black group-hover:bg-white group-hover:text-black'}
        `}
        aria-label="Dodaj do koszyka"
      >
        <Plus size={20} />
      </button>

      {/* Nazwa produktu */}
      <h3 className="text-xl font-bold mb-1">{product.name}</h3>

      {/* Skład / opis */}
      {product.description && (
        <p className={`text-sm leading-snug ${isFirst ? 'text-black' : 'text-yellow-300 group-hover:text-white'}`}>
          {product.description}
        </p>
      )}

      {/* Cena */}
      <div className="text-lg font-semibold absolute bottom-4 right-6">
        {product.price} zł
      </div>
    </div>
  );
}
