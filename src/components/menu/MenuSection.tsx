'use client';

import { useState } from 'react';
import Image from 'next/image';
import CategorySelector from './CategorySelector';
import ProductCard from './ProductCard';
import menu from '../../data/product.json';

export default function MenuSection() {
  const [selectedCategory, setSelectedCategory] = useState('Burger');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  const categoryData = menu.find((cat) => cat.category === selectedCategory);
  const subcategories = categoryData?.subcategories
    ? categoryData.subcategories.map((sub) => sub.name)
    : [];

  let products = [];
  if (selectedCategory === 'Burger' && selectedSubcategory && categoryData?.subcategories) {
    const subcat = categoryData.subcategories.find((s) => s.name === selectedSubcategory);
    products = subcat?.items || [];
  } else {
    products = categoryData?.items || [];
  }

  return (
    <section
      id="menu"
      className="relative pt-120 pb-20 px-6 md:px-20 text-white overflow-hidden"
      style={{
        backgroundImage: "url('/graffitiburger2.png')",
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* 🔲 Przyciemnione tło - takie samo jak w BurgerMiesiaca */}
      <div className="absolute inset-0 bg-black opacity-80 z-0"></div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold uppercase mb-6 border-b-4 border-yellow-400 inline-block">
          Menu
        </h2>

        <CategorySelector
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedSubcategory={selectedSubcategory}
          setSelectedSubcategory={setSelectedSubcategory}
          subcategories={subcategories}
        />

        <div className="grid gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product, index) => (
            <ProductCard
              key={index}
              product={product}
              index={index}
              isFirst={index === 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
