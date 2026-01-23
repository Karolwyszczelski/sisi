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
  price: number | string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  ingredients: string[] | string | null;
  image_url?: string | null;
  available?: boolean | null;
}

const BG_DESKTOP = "/graffitiburger2.webp";
const BG_MOBILE = "/backgroundsisi.jpg";

// identyczny overlay jak w BurgerMiesiaca
const OVERLAY_BG = `radial-gradient(
  1200px 700px at 65% 55%,
  rgba(0, 0, 0, 0.35),
  rgba(0, 0, 0, 0.82)
),
rgba(0, 0, 0, 0.55)`;

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

        if (!selectedCategory || !normalized.find((c) => c.category === selectedCategory)) {
          const nextCat = normalized[0]?.category || "";
          const nextSub = normalized[0]?.subcategories?.[0]?.name ?? "";
          setSelectedCategory(nextCat);
          setSelectedSubcategory(nextSub);
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

  const sourceMenu: RawMenuCategory[] =
    useFallback || !remoteMenu ? (menu as RawMenuCategory[]) : remoteMenu;

  const categoryData =
    sourceMenu.find((cat) => cat.category === selectedCategory) || sourceMenu[0] || null;

  const subcategories = categoryData?.subcategories
    ? categoryData.subcategories.map((sub) => sub.name)
    : [];

  useEffect(() => {
    if (!sourceMenu.length) return;

    if (!selectedCategory) {
      const firstCat = sourceMenu[0].category;
      const firstSub = sourceMenu[0].subcategories?.[0]?.name ?? "";
      setSelectedCategory(firstCat);
      setSelectedSubcategory(firstSub);
      return;
    }

    if (!categoryData) return;

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
  }, [categoryData, selectedCategory, selectedSubcategory, sourceMenu]);

  let products: any[] = [];
  if (categoryData) {
    if (categoryData.subcategories?.length && selectedSubcategory) {
      const subcat =
        categoryData.subcategories.find((s) => s.name === selectedSubcategory) ||
        categoryData.subcategories[0];
      products = subcat?.items || [];
    } else {
      products = categoryData.items || [];
    }
  }

  return (
    <section id="menu" className="shared-sec relative w-full overflow-hidden text-white">
      <div className="overlay" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-16 pb-14 md:px-20 md:pt-[120px] md:pb-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold uppercase mb-3 md:mb-6 inline-block border-b-4 border-yellow-400">
          Menu
        </h2>

        <div className="mt-2 flex justify-center">
          <CategorySelector
            selectedCategory={selectedCategory}
            setSelectedCategory={(c: string) => {
              setSelectedCategory(c);
              const newCat = sourceMenu.find((x) => x.category === c);
              setSelectedSubcategory(newCat?.subcategories?.[0]?.name ?? "");
            }}
            selectedSubcategory={selectedSubcategory}
            setSelectedSubcategory={(v: string) => setSelectedSubcategory(v)}
            subcategories={subcategories}
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
            <div className="col-span-2 lg:col-span-4 text-center py-8">
              Brak produktów w tej kategorii.
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .shared-sec {
          background-image: url("${BG_MOBILE}");
          background-position: center top;
          background-repeat: no-repeat;
          background-size: cover;
          background-attachment: scroll; /* mobile */
        }
        @media (min-width: 768px) {
          .shared-sec {
            background-image: url("${BG_DESKTOP}");
            background-attachment: fixed; /* desktop */
            background-position: center center;
          }
        }
        .overlay {
          position: absolute;
          inset: 0;
          background: ${OVERLAY_BG};
          pointer-events: none;
        }
      `}</style>
    </section>
  );
}
