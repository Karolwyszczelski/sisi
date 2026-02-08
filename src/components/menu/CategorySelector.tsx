"use client";

import { Search } from "lucide-react";

interface CategorySelectorProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;

  // UJEDNOLICONE: zawsze string ("" = brak)
  selectedSubcategory: string;
  setSelectedSubcategory: (subcategory: string) => void;

  subcategories: string[];
  
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function CategorySelector({
  selectedCategory,
  setSelectedCategory,
  selectedSubcategory,
  setSelectedSubcategory,
  subcategories,
  searchQuery,
  setSearchQuery,
}: CategorySelectorProps) {
  const categories = [
    { name: "Wszystko", icon: "🍽️" },
    { name: "Burger", icon: "🍔" },
    { name: "Pancake", icon: "🥞" },
    { name: "Kids", icon: "🎈" },
    { name: "Frytki", icon: "🍟" },
    { name: "Napoje", icon: "🥤" },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Wyszukiwarka */}
      <div className="relative max-w-md mx-auto mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          placeholder="Szukaj produktu..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 focus:bg-white/10 transition-all"
        />
      </div>

      {/* Kategorie główne - poziomy scroll na mobile */}
      <div className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => {
              setSelectedCategory(cat.name);
              setSelectedSubcategory("");
            }}
            className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-all duration-300 ${
              selectedCategory === cat.name
                ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/30 scale-105"
                : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            }`}
            type="button"
          >
            <span className="text-2xl">{cat.icon}</span>
            <span className="text-xs font-semibold tracking-wide">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Subkategorie - pills */}
      {selectedCategory === "Burger" && subcategories.length > 0 && (
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          {subcategories.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubcategory(sub)}
              className={`px-4 py-2 text-sm rounded-full transition-all duration-200 ${
                selectedSubcategory === sub
                  ? "bg-white text-black font-semibold"
                  : "text-white/60 hover:text-white border border-white/20 hover:border-white/40"
              }`}
              type="button"
            >
              {sub}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
