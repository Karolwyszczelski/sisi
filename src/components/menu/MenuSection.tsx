// src/components/MenuSection.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import CategorySelector from "./CategorySelector";
import ProductCard from "./ProductCard";
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
  price: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  ingredients: string[] | null;
  image_url?: string | null;
  available?: boolean;
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
      price: parseFloat(p.price),
      description: p.description || undefined,
      ingredients: Array.isArray(p.ingredients) ? p.ingredients : [],
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
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");

  const [remoteMenu, setRemoteMenu] = useState<RawMenuCategory[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [useFallback, setUseFallback] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchFromSupabase = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      let res = await supabase
        .from<SupabaseProduct>("products")
        .select("id, name, price, description, category, subcategory, ingredients, image_url, available")
        .eq("available", true)
        .order("category", { ascending: true })
        .order("subcategory", { ascending: true })
        .order("name", { ascending: true });

      if (res.error && /image_url does not exist/.test(res.error.message)) {
        res = await supabase
          .from<SupabaseProduct>("products")
          .select("id, name, price, description, category, subcategory, ingredients, available")
          .eq("available", true)
          .order("category", { ascending: true })
          .order("subcategory", { ascending: true })
          .order("name", { ascending: true });
      }

      if (res.error) {
        setUseFallback(true);
        setLoadError("Błąd ładowania z serwera. Pokażę lokalne menu.");
      } else if (res.data && res.data.length > 0) {
        const normalized = normalizeSupabaseData(res.data);
        setRemoteMenu(normalized);
        if (!selectedCategory || !normalized.find((c) => c.category === selectedCategory)) {
          setSelectedCategory(normalized[0]?.category || "");
          setSelectedSubcategory(normalized[0]?.subcategories?.[0]?.name || "");
        }
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

  const sourceMenu: RawMenuCategory[] = useFallback || !remoteMenu ? (menu as RawMenuCategory[]) : remoteMenu;

  const categoryData = sourceMenu.find((cat) => cat.category === selectedCategory) || sourceMenu[0] || null;
  const subcategories = categoryData?.subcategories ? categoryData.subcategories.map((sub) => sub.name) : [];

  useEffect(() => {
    if (categoryData) {
      if (!selectedSubcategory || !categoryData.subcategories?.find((s) => s.name === selectedSubcategory)) {
        setSelectedSubcategory(categoryData.subcategories?.[0]?.name || "");
      }
    }
    if (!selectedCategory && sourceMenu.length) {
      setSelectedCategory(sourceMenu[0].category);
      setSelectedSubcategory(sourceMenu[0].subcategories?.[0]?.name || "");
    }
  }, [categoryData, selectedCategory, selectedSubcategory, sourceMenu]);

  let products: any[] = [];
  if (categoryData) {
    if (categoryData.subcategories && selectedSubcategory && categoryData.subcategories.find((s) => s.name === selectedSubcategory)) {
      const subcat = categoryData.subcategories.find((s) => s.name === selectedSubcategory);
      products = subcat?.items || [];
    } else {
      products = categoryData?.items || [];
    }
  }

  return (
    <>
      {/* === MOBILE (kafelki 2 kolumny, bez slidera) === */}
      <section id="menu" className="block md:hidden relative pt-16 pb-14 px-4 bg-transparent text-white overflow-hidden">
        <div className="relative z-10 max-w-md mx-auto text-center">
          <h2 className="text-3xl font-bold uppercase mb-3 inline-block border-b-4 border-yellow-400">
            Menu
          </h2>

          <div className="mt-1 flex justify-center">
            <CategorySelector
              selectedCategory={selectedCategory}
              setSelectedCategory={(c) => {
                setSelectedCategory(c);
                const newCat = sourceMenu.find((x) => x.category === c);
                setSelectedSubcategory(newCat?.subcategories?.[0]?.name || "");
              }}
              selectedSubcategory={selectedSubcategory}
              setSelectedSubcategory={setSelectedSubcategory}
              subcategories={subcategories}
            />
          </div>

          {loadError && (
            <p className="mt-3 text-sm text-pink-300">
              Błąd ładowania: {loadError} Pokażę fallback / ostatnie dane.
            </p>
          )}

          {(loading && !products.length) && <p className="text-center mt-6">Ładowanie…</p>}

          {/* siatka kafelków: 2 kolumny (małe karty) */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {products.map((product, index) => (
              <div key={index} className="h-full [&>*]:h-full">
                <ProductCard product={product} index={index} />
              </div>
            ))}
            {!loading && products.length === 0 && (
              <div className="col-span-2 text-center py-8">Brak produktów w tej kategorii.</div>
            )}
          </div>
        </div>
      </section>

      {/* === DESKTOP === */}
      <section
        id="menu"
        className="hidden md:block relative pt-[120px] pb-20 px-6 md:px-20 text-white overflow-hidden"
        style={{
          backgroundImage: "url('/graffitiburger2.webp')",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="absolute inset-0 bg-black opacity-80 z-0" />
        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold uppercase mb-6 border-b-4 border-yellow-400 inline-block">
            Menu
          </h2>

          <div className="mt-2 flex justify-center">
            <CategorySelector
              selectedCategory={selectedCategory}
              setSelectedCategory={(c) => {
                setSelectedCategory(c);
                const newCat = sourceMenu.find((x) => x.category === c);
                setSelectedSubcategory(newCat?.subcategories?.[0]?.name || "");
              }}
              selectedSubcategory={selectedSubcategory}
              setSelectedSubcategory={setSelectedSubcategory}
              subcategories={subcategories}
            />
          </div>

          {loadError && (
            <p className="text-sm text-pink-300 mb-2">
              Błąd ładowania: {loadError} Pokażę fallback / ostatnie dane.
            </p>
          )}

          <div className="grid gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-4 justify-items-center auto-rows-[1fr]">
            {products.map((product, index) => (
              <div key={index} className="h-full [&>*]:h-full w-full">
                <ProductCard product={product} index={index} />
              </div>
            ))}
            {!loading && products.length === 0 && (
              <div className="col-span-full text-center py-8">Brak produktów w tej kategorii.</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
