// src/components/MenuSection.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Search, Plus, Check } from "lucide-react";
import CategorySelector from "./CategorySelector";
import ProductCard from "./ProductCard";
import useCartStore from "@/store/cartStore";
import menu from "../../data/product.json";

export interface RawMenuCategory {
  category: string;
  subcategories?: {
    name: string;
    items: {
      name: string;
      price: number;
      description?: string;
      ingredients?: string[];
      imageUrl?: string;
      available?: boolean;
    }[];
  }[];
  items?: {
    name: string;
    price: number;
    description?: string;
    ingredients?: string[];
    imageUrl?: string;
    available?: boolean;
  }[];
}

export interface SupabaseProduct {
  id: string;
  name: string;
  price: number | string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  ingredients: string[] | string | null;
  image_url?: string | null;
  available?: boolean | null;
}

function parseIngredients(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);

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

function money(v: any): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100) / 100;
  const s = String(v ?? "0").replace(/[^0-9,.\-]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function normalizeSupabaseData(data: SupabaseProduct[]): RawMenuCategory[] {
  const map: Record<string, Record<string, any[]>> = {};

  data.forEach((p) => {
    if (p.available === false) return;

    const cat = p.category || "Inne";
    const sub = p.subcategory;

    if (!map[cat]) map[cat] = {};

    const itemObj = {
      name: p.name,
      price: money(p.price),
      description: p.description || undefined,
      ingredients: parseIngredients(p.ingredients),
      imageUrl: p.image_url || undefined,
      available: p.available ?? true,
    };

    if (sub) {
      if (!map[cat][sub]) map[cat][sub] = [];
      map[cat][sub].push(itemObj);
    } else {
      if (!map[cat]["__base__"]) map[cat]["__base__"] = [];
      map[cat]["__base__"].push(itemObj);
    }
  });

  return Object.entries(map).map(([category, subs]) => {
    const subcategories = Object.entries(subs)
      .filter(([name]) => name !== "__base__")
      .map(([name, items]) => ({ name, items: items as any[] }));

    return {
      category,
      subcategories: subcategories.length ? subcategories : undefined,
      items: subs["__base__"] ? (subs["__base__"] as any[]) : undefined,
    } as RawMenuCategory;
  });
}

const supabase = getSupabaseBrowser();

export default function MenuSection() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Wszystko");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [remoteMenu, setRemoteMenu] = useState<RawMenuCategory[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [useFallback, setUseFallback] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchFromSupabase = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const selectWithImage =
        "id, name, price, description, category, subcategory, ingredients, image_url, available";
      const selectNoImage =
        "id, name, price, description, category, subcategory, ingredients, available";

      let data: SupabaseProduct[] | null = null;
      let error: any | null = null;

      const r1 = await supabase
        .from("products")
        .select(selectWithImage)
        .eq("available", true)
        .order("category", { ascending: true })
        .order("subcategory", { ascending: true })
        .order("name", { ascending: true });

      data = (r1.data as SupabaseProduct[] | null) ?? null;
      error = r1.error;

      if (error && /image_url does not exist/i.test(String(error.message || ""))) {
        const r2 = await supabase
          .from("products")
          .select(selectNoImage)
          .eq("available", true)
          .order("category", { ascending: true })
          .order("subcategory", { ascending: true })
          .order("name", { ascending: true });

        data = (r2.data as SupabaseProduct[] | null) ?? null;
        error = r2.error;
      }

      if (error) {
        setUseFallback(true);
        setLoadError("Błąd ładowania z serwera. Pokażę lokalne menu.");
      } else if (data && data.length > 0) {
        const normalized = normalizeSupabaseData(data);
        setRemoteMenu(normalized);
        setUseFallback(false);
      } else {
        setUseFallback(true);
      }
    } catch {
      setUseFallback(true);
      setLoadError("Nieoczekiwany błąd przy ładowaniu menu.");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchFromSupabase();

    const channel = supabase
      .channel("public:products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        fetchFromSupabase();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchFromSupabase]);

  const sourceMenu: RawMenuCategory[] =
    useFallback || !remoteMenu ? (menu as RawMenuCategory[]) : remoteMenu;

  const categoryData =
    selectedCategory === "Wszystko" 
      ? null 
      : (sourceMenu.find((cat) => cat.category === selectedCategory) || null);

  const subcategories = categoryData?.subcategories
    ? categoryData.subcategories.map((sub) => sub.name)
    : [];

  useEffect(() => {
    // Tylko ustaw subkategorię gdy zmieni się kategoria (nie "Wszystko")
    if (selectedCategory === "Wszystko" || !categoryData) return;

    if (categoryData.subcategories?.length) {
      if (
        !selectedSubcategory ||
        !categoryData.subcategories.some((s) => s.name === selectedSubcategory)
      ) {
        setSelectedSubcategory(categoryData.subcategories[0]?.name ?? "");
      }
    } else {
      if (selectedSubcategory) setSelectedSubcategory("");
    }
  }, [categoryData, selectedCategory, selectedSubcategory]);

  let products: any[] = [];
  if (selectedCategory === "Wszystko") {
    // Pokaż wszystkie produkty ze wszystkich kategorii
    sourceMenu.forEach((cat) => {
      if (cat.items) {
        products = [...products, ...cat.items];
      }
      if (cat.subcategories) {
        cat.subcategories.forEach((sub) => {
          products = [...products, ...sub.items];
        });
      }
    });
  } else if (categoryData) {
    if (categoryData.subcategories?.length && selectedSubcategory) {
      const subcat =
        categoryData.subcategories.find((s) => s.name === selectedSubcategory) ||
        categoryData.subcategories[0];
      products = subcat?.items || [];
    } else {
      products = categoryData.items || [];
    }
  }

  // Filtrowanie po wyszukiwaniu
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    products = products.filter((p) => 
      p.name?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.ingredients?.some((ing: string) => ing.toLowerCase().includes(query))
    );
  }

  return (
    <section id="menu" className="relative w-full overflow-hidden text-white bg-black">
      {/* Tło gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-900/50 to-black" />
      
      {/* Subtelne świecące akcenty - tylko desktop */}
      <div className="hidden md:block absolute top-1/3 left-0 w-80 h-80 bg-yellow-500/5 rounded-full blur-[100px]" />
      <div className="hidden md:block absolute bottom-1/3 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-[120px]" />

      {/* DESKTOP */}
      <div className="hidden md:block relative z-10 mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24 text-center">
        {/* Nagłówek sekcji */}
        <div className="mb-10 md:mb-14">
          <h2 className="text-4xl md:text-6xl font-black tracking-tight">
            NASZE <span className="text-yellow-400">MENU</span>
          </h2>
          <p className="mt-3 text-white/60 text-sm md:text-base max-w-md mx-auto">
            Wybierz coś pysznego dla siebie
          </p>
        </div>

        <div className="mt-2 flex justify-center">
          <CategorySelector
            selectedCategory={selectedCategory}
            setSelectedCategory={(c: string) => {
              setSelectedCategory(c);
              if (c === "Wszystko") {
                setSelectedSubcategory("");
              } else {
                const newCat = sourceMenu.find((x) => x.category === c);
                setSelectedSubcategory(newCat?.subcategories?.[0]?.name ?? "");
              }
            }}
            selectedSubcategory={selectedSubcategory}
            setSelectedSubcategory={(v: string) => setSelectedSubcategory(v)}
            subcategories={subcategories}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </div>

        {loadError && (
          <p className="mt-3 md:mt-2 text-sm text-pink-300">
            Błąd ładowania: {loadError} Pokażę fallback / ostatnie dane.
          </p>
        )}

        {loading && !products.length && <p className="text-center mt-6">Ładowanie…</p>}

        <div className="mt-5 md:mt-8 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-6 justify-items-center auto-rows-[1fr]">
          {products.map((product, index) => (
            <div key={index} className="h-full w-full [&>*]:h-full">
              <ProductCard product={product} index={index} />
            </div>
          ))}

          {!loading && products.length === 0 && (
            <div className="col-span-2 lg:col-span-4 text-center py-8 text-white/60">
              {searchQuery ? `Nie znaleziono produktów dla "${searchQuery}"` : "Brak produktów w tej kategorii."}
            </div>
          )}
        </div>
      </div>

      {/* MOBILE - zoptymalizowany widok */}
      <div className="md:hidden relative z-10">
        {/* Nagłówek sekcji */}
        <div className="pt-4 pb-2 px-4">
          <h2 className="text-3xl font-black tracking-tight text-center">
            NASZE <span className="text-yellow-400">MENU</span>
          </h2>
          <p className="mt-1 text-white/50 text-xs text-center">
            Wybierz coś pysznego dla siebie
          </p>
        </div>

        {/* Sticky header z kategoriami */}
        <div className="sticky top-14 z-30 bg-zinc-950/95 backdrop-blur-xl border-b border-white/5 pb-4 pt-3 px-4">
          {/* Wyszukiwarka */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Szukaj..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 transition-all"
            />
          </div>
          
          {/* Kategorie - grid 3x2 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { name: "Wszystko", icon: "🍽️" },
              { name: "Burger", icon: "🍔" },
              { name: "Pancake", icon: "🥞" },
              { name: "Kids", icon: "🧒" },
              { name: "Frytki", icon: "🍟" },
              { name: "Napoje", icon: "🥤" },
            ].map((cat) => (
              <button
                key={cat.name}
                onClick={() => {
                  setSelectedCategory(cat.name);
                  if (cat.name === "Wszystko") {
                    setSelectedSubcategory("");
                  } else {
                    const newCat = sourceMenu.find((x) => x.category === cat.name);
                    setSelectedSubcategory(newCat?.subcategories?.[0]?.name ?? "");
                  }
                }}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-xs transition-all ${
                  selectedCategory === cat.name
                    ? "bg-yellow-400 text-black font-bold"
                    : "bg-white/5 text-white/70 border border-white/5"
                }`}
              >
                <span className="text-lg">{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Subkategorie dla Burger */}
          {selectedCategory === "Burger" && subcategories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              {subcategories.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubcategory(sub)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                    selectedSubcategory === sub
                      ? "bg-white text-black font-semibold"
                      : "text-white/60 border border-white/20"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lista produktów - kompaktowy format */}
        <div className="px-4 pb-24 pt-6 space-y-3">
          {loading && !products.length && (
            <p className="text-center py-8 text-white/60">Ładowanie…</p>
          )}

          {products.map((product, index) => (
            <MobileProductCard key={index} product={product} isFirst={index === 0} />
          ))}

          {!loading && products.length === 0 && (
            <div className="text-center py-12 text-white/60">
              {searchQuery ? `Nie znaleziono "${searchQuery}"` : "Brak produktów"}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Kompaktowa karta produktu dla mobile
function MobileProductCard({ product, isFirst }: { product: any; isFirst: boolean }) {
  const addItem = useCartStore((state) => state.addItem);
  const [added, setAdded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Parsuj składniki
  const ingredients = Array.isArray(product.ingredients) 
    ? product.ingredients.join(" · ") 
    : product.description || "";

  const handleAdd = () => {
    addItem({ name: product.name, price: product.price });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div
      className={`
        relative rounded-2xl overflow-hidden
        transition-all
        ${isFirst 
          ? "bg-gradient-to-r from-yellow-400 to-amber-500" 
          : "bg-zinc-900 border border-white/5"
        }
        ${added ? "scale-[0.98]" : ""}
      `}
    >
      {/* Badge HIT */}
      {isFirst && (
        <span className="absolute top-2 right-2 bg-black text-yellow-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-full z-10">
          HIT
        </span>
      )}

      {/* Główna część - klikalna do dodania */}
      <div 
        onClick={handleAdd}
        className="flex items-center gap-3 p-4 active:opacity-80 cursor-pointer"
      >
        {/* Zawartość */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold text-base ${isFirst ? "text-black" : "text-white"}`}>
            {product.name}
          </h3>
        </div>

        {/* Cena */}
        <div className={`text-right flex-shrink-0 ${isFirst ? "text-black" : "text-white"}`}>
          <span className="text-2xl font-black">{product.price}</span>
          <span className={`text-sm ml-0.5 ${isFirst ? "text-black/60" : "text-white/40"}`}>zł</span>
        </div>

        {/* Przycisk dodaj */}
        <button
          onClick={(e) => { e.stopPropagation(); handleAdd(); }}
          className={`
            w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
            transition-all
            ${isFirst 
              ? "bg-black text-yellow-400" 
              : "bg-yellow-400 text-black"
            }
            ${added ? "scale-90" : ""}
          `}
        >
          {added ? <Check size={22} strokeWidth={3} /> : <Plus size={22} strokeWidth={2.5} />}
        </button>
      </div>

      {/* Opis/składniki - rozwijany */}
      {ingredients && (
        <div 
          onClick={toggleExpand}
          className="px-4 pb-4 cursor-pointer"
        >
          <p 
            className={`
              text-xs leading-relaxed
              ${expanded ? "" : "line-clamp-1"}
              ${isFirst ? "text-black/70" : "text-white/50"}
            `}
          >
            {ingredients}
          </p>
          {ingredients.length > 40 && (
            <span
              className={`text-[10px] font-semibold inline-block mt-1 ${isFirst ? "text-black/80" : "text-yellow-400"}`}
            >
              {expanded ? "▲ Zwiń" : "▼ Pokaż więcej"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
