"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key);
};

let _supabase: ReturnType<typeof getSupabase> | null = null;
const supabase = new Proxy({} as ReturnType<typeof getSupabase>, {
  get(_, prop) {
    if (!_supabase) _supabase = getSupabase();
    return (_supabase as any)[prop];
  },
});

// --- pomocnicze typy ---
export interface Product {
  name: string;
  price: number;
  quantity: number;
  meatType?: "wołowina" | "kurczak";
  addons?: string[];
  extraMeatCount?: number;
  note?: string;
}

interface EditOrderButtonProps {
  orderId: string;
  currentProducts: Product[];
  currentSelectedOption: "local" | "takeaway" | "delivery";
  onOrderUpdated: (orderId: string, updatedData?: Partial<any>) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

interface MenuProduct {
  name: string;
  price: number;
  available_addons: string[] | null;
}

// Typ dla dodatku z bazy
interface Addon {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

// --- normalizacja nazwy bez błędu jeśli undefined ---
function normalizeName(str?: string): string {
  if (!str || typeof str !== "string") return "";
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

function getOptionLabel(option: "local" | "takeaway" | "delivery") {
  if (option === "local") return "NA MIEJSCU";
  if (option === "takeaway") return "NA WYNOS";
  if (option === "delivery") return "DOSTAWA";
  return "";
}

export default function EditOrderButton({
  orderId,
  currentProducts,
  currentSelectedOption,
  onOrderUpdated,
  onEditStart,
  onEditEnd,
}: EditOrderButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [menuProducts, setMenuProducts] = useState<MenuProduct[]>([]);
  const [packagingCostSetting, setPackagingCostSetting] = useState<number>(2);
  const [addonsFromDb, setAddonsFromDb] = useState<Addon[]>([]);
  const [selectedOption, setSelectedOption] = useState<"local" | "takeaway" | "delivery">(
    currentSelectedOption
  );
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Funkcja do pobierania ceny dodatku z bazy
  const getAddonPrice = (addonName: string): number => {
    const addon = addonsFromDb.find(
      (a) => a.name.toLowerCase() === addonName.toLowerCase()
    );
    if (addon) return addon.price;
    // Fallback jeśli nie znaleziono
    if (addonName.toLowerCase() === "płynny ser") return 6;
    if (["amerykański", "ketchup", "majonez", "musztarda", "meksykański", "serowy chili", "czosnkowy", "musztardowo-miodowy", "bbq"].includes(addonName.toLowerCase())) return 3;
    return 4;
  };

  // Pobierz produkty, packaging_cost i dodatki z bazy
  useEffect(() => {
    // Pobierz produkty z bazy
    supabase
      .from("products")
      .select("name, price, available_addons")
      .then((r) => {
        if (!r.error && r.data) {
          const parsed = r.data.map((p: any) => ({
            name: p.name || "",
            price: typeof p.price === "number" ? p.price : parseFloat(String(p.price).replace(",", ".")) || 0,
            available_addons: Array.isArray(p.available_addons) ? p.available_addons : null,
          }));
          setMenuProducts(parsed);
        }
      });

    // Pobierz packaging_cost
    supabase
      .from("restaurant_info")
      .select("packaging_cost")
      .eq("id", 1)
      .single()
      .then((r) => {
        if (!r.error && r.data && typeof r.data.packaging_cost === "number") {
          setPackagingCostSetting(r.data.packaging_cost);
        }
      });

    // Pobierz dodatki z bazy
    supabase
      .from("addons")
      .select("id, name, price, category, available")
      .eq("available", true)
      .order("display_order", { ascending: true })
      .then((r) => {
        if (!r.error && r.data) {
          setAddonsFromDb(r.data as Addon[]);
        }
      });
  }, []);

  // inicjalizacja lokalnego stanu przy otwarciu
  useEffect(() => {
    if (showModal && menuProducts.length > 0) {
      onEditStart?.();
      const normalized = currentProducts.map((item) => {
        const found = menuProducts.find(
          (p) => normalizeName(p.name) === normalizeName(item.name)
        );
        if (!found) {
          console.warn("Nie znaleziono ceny dla produktu:", item.name);
        }
        return {
          name: item.name,
          price: found?.price ?? item.price ?? 0,
          quantity: item.quantity !== undefined ? item.quantity : 1,
          extraMeatCount: item.extraMeatCount !== undefined ? item.extraMeatCount : 0,
          addons: item.addons ? [...item.addons] : [],
          meatType: item.meatType || "wołowina",
          note: item.note || "",
        } as Product;
      });
      setProducts(normalized);
      setSelectedOption(currentSelectedOption);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, menuProducts]);

  // zamknięcie modala - wywołaj onEditEnd
  const closeModal = () => {
    setShowModal(false);
    onEditEnd?.();
  };

  const handleQuantityChange = (index: number, newValue: string) => {
    const qty = parseInt(newValue);
    setProducts((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, quantity: isNaN(qty) ? 1 : qty } : p
      )
    );
  };

  const handleExtraMeatChange = (index: number, newValue: string) => {
    const count = parseInt(newValue);
    setProducts((prev) =>
      prev.map((p, i) =>
        i === index
          ? { ...p, extraMeatCount: isNaN(count) ? 0 : count }
          : p
      )
    );
  };

  const handleMeatChange = (index: number, meat: "wołowina" | "kurczak") => {
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, meatType: meat } : p))
    );
  };

  const toggleAddon = (index: number, addon: string) => {
    setProducts((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const hasAddon = p.addons?.includes(addon);
        return {
          ...p,
          addons: hasAddon
            ? p.addons!.filter((a) => a !== addon)
            : [...(p.addons || []), addon],
        };
      })
    );
  };

  const handleRemoveProduct = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateBaseTotal = () => {
    return products.reduce((acc, item) => {
      const quantity = item.quantity || 1;
      const addonsCost = (item.addons || []).reduce((sum: number, addon: string) => sum + getAddonPrice(addon), 0);
      const extraMeatCost = (item.extraMeatCount || 0) * 15;
      return acc + (item.price + addonsCost + extraMeatCost) * quantity;
    }, 0);
  };

  const getPackagingCost = () => {
    return selectedOption === "takeaway" || selectedOption === "delivery" ? packagingCostSetting : 0;
  };

  const calculateTotalWithPackaging = () => {
    return calculateBaseTotal() + getPackagingCost();
  };

  const handleAddNewProduct = (productName: string, productPrice: number) => {
    setProducts((prev) => [
      ...prev,
      {
        name: productName,
        price: productPrice,
        quantity: 1,
        addons: [],
        extraMeatCount: 0,
        meatType: "wołowina",
        note: "",
      },
    ]);
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: JSON.stringify(products),
          selected_option: selectedOption,
          total_price: calculateTotalWithPackaging(),
        }),
      });
      if (res.ok) {
        const { order } = await res.json();
        onOrderUpdated(orderId, order);
        closeModal();
      } else {
        const result = await res.json();
        console.error("Błąd edycji zamówienia:", result);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  const ProductEditor: React.FC<{ product: Product; index: number }> = ({
    product,
    index,
  }) => {
    return (
      <div className="border border-slate-700 bg-slate-900/60 p-4 mb-4 rounded-xl">
        <div className="flex justify-between flex-wrap">
          <p className="font-semibold text-white">{product.name}</p>
          <span className="text-amber-400 font-medium">{product.price.toFixed(2)} zł</span>
        </div>

        <div className="mt-3">
          <span className="font-semibold text-sm text-slate-400">Mięso:</span>
          <div className="flex gap-2 mt-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleMeatChange(index, "wołowina")}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                product.meatType === "wołowina"
                  ? "bg-amber-600 text-white font-bold"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              Wołowina
            </button>
            <button
              type="button"
              onClick={() => handleMeatChange(index, "kurczak")}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                product.meatType === "kurczak"
                  ? "bg-amber-600 text-white font-bold"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              Kurczak
            </button>
          </div>
        </div>

        <div className="mt-3">
          <span className="font-semibold text-sm text-slate-400">Dodatki:</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {(() => {
              // Znajdź produkt w menuProducts żeby pobrać jego available_addons
              const menuProduct = menuProducts.find(
                (p) => normalizeName(p.name) === normalizeName(product.name)
              );
              // Użyj dodatków z produktu lub wszystkich z bazy (tylko kategoria "dodatek" i "premium")
              const allDbAddonNames = addonsFromDb
                .filter(a => a.category === "dodatek" || a.category === "premium")
                .map(a => a.name);
              const addons = menuProduct?.available_addons?.length 
                ? menuProduct.available_addons 
                : allDbAddonNames.length > 0 ? allDbAddonNames : ["Ser", "Bekon", "Jalapeño", "Ogórek", "Rukola", "Czerwona cebula", "Pomidor", "Pikle", "Nachosy", "Konfitura z cebuli", "Gruszka", "Płynny ser"];
              return addons.map((addon) => {
                const hasAddon = product.addons?.includes(addon);
                const price = getAddonPrice(addon);
                return (
                  <button
                    key={addon}
                    type="button"
                    onClick={() => toggleAddon(index, addon)}
                    className={`border text-xs px-3 py-1.5 rounded-lg flex-shrink-0 min-w-[60px] transition-colors ${
                      hasAddon
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {hasAddon ? `✓ ${addon} (+${price}zł)` : `+ ${addon} (+${price}zł)`}
                  </button>
                );
              });
            })()}
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-sm text-slate-400 min-w-[120px]">Dodatkowe mięso:</label>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() =>
                  handleExtraMeatChange(
                    index,
                    String(Math.max(product.extraMeatCount! - 1, 0))
                  )
                }
                disabled={(product.extraMeatCount || 0) <= 0}
                className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                -
              </button>
              <span className="mx-3 text-white font-medium w-4 text-center">{product.extraMeatCount || 0}</span>
              <button
                type="button"
                onClick={() =>
                  handleExtraMeatChange(
                    index,
                    String((product.extraMeatCount || 0) + 1)
                  )
                }
                className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                +
              </button>
              <span className="text-xs text-slate-500 ml-2">x +15 zł</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1">
            <label className="text-sm text-slate-400 min-w-[120px]">Ilość burgera:</label>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() =>
                  handleQuantityChange(
                    index,
                    String(Math.max(product.quantity - 1, 1))
                  )
                }
                disabled={product.quantity <= 1}
                className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                -
              </button>
              <span className="mx-3 text-white font-medium w-4 text-center">{product.quantity}</span>
              <button
                type="button"
                onClick={() =>
                  handleQuantityChange(index, String(product.quantity + 1))
                }
                className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleRemoveProduct(index)}
          className="mt-4 bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/30 text-rose-400 px-4 py-2 text-sm rounded-lg transition-colors"
        >
          Usuń produkt
        </button>
      </div>
    );
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="h-10 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 px-4 rounded-lg font-medium transition-colors"
      >
        Edytuj
      </button>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 z-50">
          <div className="relative bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* header */}
            <div className="sticky top-0 bg-slate-800 z-10 border-b border-slate-700 px-5 py-4 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold leading-tight text-white truncate">
                  Zamówienie: {getOptionLabel(selectedOption)}
                </h3>
                <h4 className="text-base font-medium mt-1 text-slate-400">Edytuj zamówienie</h4>
              </div>
              <button
                type="button"
                aria-label="Zamknij"
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-slate-700 flex-shrink-0 transition-colors"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-slate-400"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 flex flex-col space-y-4">
              <div className="flex flex-wrap gap-2">
                {(["local", "takeaway", "delivery"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSelectedOption(option)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex-1 min-w-[90px] transition-colors ${
                      selectedOption === option
                        ? "bg-amber-600 text-white font-bold"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    {option === "local"
                      ? "Na miejscu"
                      : option === "takeaway"
                      ? "Na wynos"
                      : "Dostawa"}
                  </button>
                ))}
              </div>

              {products.map((product, index) => (
                <ProductEditor
                  key={`${product.name}-${index}`}
                  product={product}
                  index={index}
                />
              ))}

              <div>
                <button
                  type="button"
                  onClick={() => setShowAddProduct(true)}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-3 rounded-lg font-medium transition-colors"
                >
                  + Dodaj produkt
                </button>
              </div>

              {showAddProduct && (
                <div className="border border-slate-700 bg-slate-900/60 p-4 rounded-lg">
                  <h4 className="font-bold mb-3 text-white">Wybierz produkt</h4>
                  <ul className="space-y-1 max-h-52 overflow-auto">
                    {MENU_PRODUCTS.map((prod) => (
                      <li key={prod.name}>
                        <button
                          type="button"
                          onClick={() => {
                            handleAddNewProduct(prod.name, prod.price);
                            setShowAddProduct(false);
                          }}
                          className="block w-full text-left px-4 py-2.5 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          {prod.name} - <span className="text-amber-400">{prod.price} zł</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setShowAddProduct(false)}
                    className="mt-3 text-rose-400 text-sm hover:text-rose-300 transition-colors"
                  >
                    Anuluj
                  </button>
                </div>
              )}

              <div className="mt-2 text-sm space-y-2 border-t border-slate-700 pt-4">
                <div className="flex justify-between text-slate-400">
                  <span>Suma produktów:</span>
                  <span className="text-slate-300">{calculateBaseTotal().toFixed(2)} zł</span>
                </div>
                {(selectedOption === "takeaway" ||
                  selectedOption === "delivery") && (
                  <div className="flex justify-between text-slate-400">
                    <span>Opakowanie:</span>
                    <span className="text-slate-300">{getPackagingCost().toFixed(2)} zł</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-slate-700 pt-3 mt-2">
                  <span className="text-white">Razem do zapłaty:</span>
                  <span className="text-amber-400 text-lg">{calculateTotalWithPackaging().toFixed(2)} zł</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Zapisz zmiany
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-3 rounded-lg font-semibold transition-colors"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
