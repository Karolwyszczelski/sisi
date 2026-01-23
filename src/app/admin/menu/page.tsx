// src/app/admin/menu/page.tsx  (pełny plik z globalnym przełącznikiem zamawiania)
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Pencil, Trash, ToggleRight, ChevronDown, Power } from "lucide-react";
import debounce from "lodash.debounce";

/* ===================== Typy ===================== */
interface Product {
  id: string;
  name: string | null;
  price: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  ingredients: string[] | null;
  image_url?: string | null;
  available: boolean;
  available_addons?: string[] | null;
  created_at?: string;
  updated_at?: string;
}

/* Supabase klient (po stronie klienta) */
const supabase = createClientComponentClient();

/* ===================== Modal edycji ===================== */
function EditProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: (p: Product) => void;
}) {
  const [form, setForm] = useState({
    name: product.name ?? "",
    price: product.price ?? "",
    description: product.description ?? "",
    category: product.category ?? "",
    subcategory: product.subcategory ?? "",
    ingredientsText: (product.ingredients ?? []).join(", "),
    image_url: product.image_url ?? "",
    addonsText: (product.available_addons ?? []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const splitToArray = (txt: string) =>
    txt
      .split(/,|\n/)
      .map((s) => s.trim())
      .filter(Boolean);

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const payload: Partial<Product> = {
        name: form.name || null,
        price: form.price ?? null,
        description: form.description || null,
        category: form.category || null,
        subcategory: form.subcategory || null,
        ingredients: splitToArray(form.ingredientsText),
        image_url: form.image_url || null,
        available_addons: splitToArray(form.addonsText),
      };

      const { data, error } = await supabase
        .from<Product>("products")
        .update(payload)
        .eq("id", product.id)
        .select("*")
        .single();

      if (error) throw error;
      onSaved(data as Product);
      onClose();
    } catch (e: any) {
      setErr(e.message || "Nie udało się zapisać zmian.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-xl font-bold">Edytuj produkt</h3>
          <button onClick={onClose} className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
            Zamknij
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {err && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium mb-1 uppercase text-gray-600">Nazwa</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 uppercase text-gray-600">Cena (np. 28.00)</label>
              <input
                value={form.price ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1 uppercase text-gray-600">Opis</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 uppercase text-gray-600">Kategoria</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 uppercase text-gray-600">Podkategoria</label>
              <input
                value={form.subcategory}
                onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1 uppercase text-gray-600">
                Składniki (oddzielaj przecinkiem lub enterem)
              </label>
              <textarea
                value={form.ingredientsText}
                onChange={(e) => setForm((f) => ({ ...f, ingredientsText: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                rows={3}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1 uppercase text-gray-600">
                Dodatki dostępne (opcjonalne, oddzielaj przecinkiem lub enterem)
              </label>
              <textarea
                value={form.addonsText}
                onChange={(e) => setForm((f) => ({ ...f, addonsText: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                rows={2}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1 uppercase text-gray-600">URL obrazka</label>
              <input
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded border px-4 py-2 text-sm hover:bg-gray-50">
            Anuluj
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Strona ===================== */
export default function AdminMenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filterCat, setFilterCat] = useState<string>("Wszystkie");
  const [sortKey, setSortKey] = useState<"nameAsc" | "nameDesc" | "priceAsc" | "priceDesc">("nameAsc");
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);

  // GLOBALNE ZAMAWIANIE
  const [orderingOpen, setOrderingOpen] = useState<boolean | null>(null);
  const [toggleOrderingBusy, setToggleOrderingBusy] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data, error: err }, ri] = await Promise.all([
        supabase
          .from<Product>("products")
          .select("*")
          .order("category", { ascending: true })
          .order("subcategory", { ascending: true })
          .order("name", { ascending: true }),
        supabase.from("restaurant_info").select("ordering_open").eq("id", 1).maybeSingle(),
      ]);

      if (err) throw err;
      setProducts(data ?? []);
      if (!ri.error && ri.data) setOrderingOpen(Boolean((ri.data as any).ordering_open));
      setError(null);
    } catch (e: any) {
      console.error("Błąd pobierania:", e);
      setError(e.message || "Błąd ładowania danych");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();

    const chProducts = supabase
      .channel("public:products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        void fetchProducts();
      })
      .subscribe();

    const chRestaurant = supabase
      .channel("public:restaurant_info")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_info", filter: "id=eq.1" }, (p) => {
        const row = (p as any).new || (p as any).record;
        if (row && typeof row.ordering_open === "boolean") {
          setOrderingOpen(row.ordering_open);
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(chProducts);
      void supabase.removeChannel(chRestaurant);
    };
  }, [fetchProducts]);

  const toggleAvailability = async (id: string, current: boolean) => {
    setTogglingId(id);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, available: !current } : p))); // optymistycznie
    try {
      const { error: err } = await supabase.from("products").update({ available: !current }).eq("id", id);
      if (err) {
        console.error("Błąd aktualizacji dostępności:", err);
        alert(`Nie udało się zmienić dostępności: ${err.message}`);
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, available: current } : p)));
      }
    } catch (e: any) {
      console.error("Błąd aktualizacji dostępności (catch):", e);
      alert("Nie udało się zmienić dostępności");
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, available: current } : p)));
    } finally {
      setTogglingId(null);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Na pewno usunąć ten produkt?")) return;
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) {
        console.error("Błąd usuwania produktu:", error);
        alert("Nie udało się usunąć produktu");
        return;
      }
      setProducts((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      console.error("Błąd usuwania produktu (catch):", e);
      alert("Nie udało się usunąć produktu");
    }
  };

  // GLOBAL TOGGLE
  const flipOrdering = async () => {
    if (orderingOpen == null) return;
    setToggleOrderingBusy(true);
    try {
      const next = !orderingOpen;
      // optymistycznie
      setOrderingOpen(next);
      const { error } = await supabase.from("restaurant_info").update({ ordering_open: next }).eq("id", 1);
      if (error) {
        setOrderingOpen(!next);
        alert("Nie udało się zmienić statusu zamawiania: " + error.message);
      }
    } catch (e: any) {
      setOrderingOpen((v) => !v);
      alert("Nie udało się zmienić statusu zamawiania.");
    } finally {
      setToggleOrderingBusy(false);
    }
  };

  /* Kategorie do filtra */
  const categories = useMemo(() => {
    return Array.from(
      new Set(
        products.flatMap((p) => {
          if (p.subcategory) return [`${p.category} > ${p.subcategory}`, p.category || "Bez kategorii"];
          return [p.category || "Bez kategorii"];
        })
      )
    )
      .filter(Boolean)
      .sort();
  }, [products]);

  /* Filtrowanie + sort + search */
  const filtered = useMemo(() => {
    return products
      .filter((p) => {
        if (filterCat !== "Wszystkie") {
          if (p.subcategory) {
            if (`${p.category} > ${p.subcategory}` !== filterCat) return false;
          } else if ((p.category || "") !== filterCat) return false;
        }
        if (search.trim()) {
          const term = search.toLowerCase();
          return (p.name || "").toLowerCase().includes(term) || (p.description || "").toLowerCase().includes(term);
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortKey) {
          case "nameAsc":
            return (a.name || "").localeCompare(b.name || "");
          case "nameDesc":
            return (b.name || "").localeCompare(a.name || "");
          case "priceAsc":
            return parseFloat(a.price || "0") - parseFloat(b.price || "0");
          case "priceDesc":
            return parseFloat(b.price || "0") - parseFloat(a.price || "0");
          default:
            return 0;
        }
      });
  }, [products, filterCat, sortKey, search]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onSearchChange = useCallback(
    debounce((v: string) => setSearch(v), 300),
    []
  );

  const handleSaved = (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      {/* Banner globalnego statusu */}
      {orderingOpen === false && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          Zamawianie jest obecnie <b>wyłączone</b>. Klienci nie mogą składać zamówień.
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Zarządzanie Menu</h1>
          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto items-end">
          {/* GLOBALNY PRZEŁĄCZNIK */}
          <div className="flex items-end">
            <button
              onClick={flipOrdering}
              disabled={orderingOpen == null || toggleOrderingBusy}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium shadow-sm border transition
                ${orderingOpen ? "bg-green-600 text-white border-green-700 hover:bg-green-700" : "bg-gray-200 text-gray-800 border-gray-300 hover:bg-gray-300"}`}
              title="Włącz/wyłącz przyjmowanie zamówień"
            >
              <Power className="w-4 h-4" />
              {orderingOpen ? "Zamawianie: WŁĄCZONE" : "Zamawianie: WYŁĄCZONE"}
            </button>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium mb-1 uppercase text-gray-600">Kategoria</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="Wszystkie">Wszystkie</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium mb-1 uppercase text-gray-600">Sortuj</label>
            <div className="relative">
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 shadow-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                value={sortKey}
                onChange={(e) =>
                  setSortKey(e.target.value as "nameAsc" | "nameDesc" | "priceAsc" | "priceDesc")
                }
              >
                <option value="nameAsc">Nazwa ↑</option>
                <option value="nameDesc">Nazwa ↓</option>
                <option value="priceAsc">Cena ↑</option>
                <option value="priceDesc">Cena ↓</option>
              </select>
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium mb-1 uppercase text-gray-600">Szukaj</label>
            <input
              type="text"
              placeholder="Nazwa lub opis"
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => fetchProducts()}
              disabled={loading}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
            >
              Odśwież
            </button>
          </div>
        </div>
      </div>

      {/* Tabela desktop */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow">
          <table className="min-w-full divide-y divide-gray-200 bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">#</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Nazwa</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Cena</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Kategoria
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Dostępność
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-4 bg-gray-200 rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-40 bg-gray-200 rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
                      <td className="px-6 py-4 text-center"><div className="h-6 w-16 bg-gray-200 rounded-full inline-block" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 w-28 bg-gray-200 rounded inline-block" /></td>
                    </tr>
                  ))
                : filtered.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Brak produktów do wyświetlenia.
                    </td>
                  </tr>
                )
                : filtered.map((it, i) => (
                    <tr key={it.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{i + 1}</td>
                      <td className="px-6 py-4 text-sm">{it.name}</td>
                      <td className="px-6 py-4 text-sm">{parseFloat(it.price || "0").toFixed(2)} zł</td>
                      <td className="px-6 py-4 text-sm">
                        {it.subcategory ? `${it.category} > ${it.subcategory}` : it.category}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleAvailability(it.id, it.available)}
                          disabled={togglingId === it.id}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition ${
                            it.available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          } ${togglingId === it.id ? "opacity-70 cursor-not-allowed" : "hover:scale-105"}`}
                        >
                          {it.available ? "Dostępny" : "Wyłączony"} <ToggleRight className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right flex gap-2 justify-end">
                        <button
                          onClick={() => setEditing(it)}
                          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                        >
                          <Pencil size={16} /> Edytuj
                        </button>
                        <button
                          onClick={() => deleteProduct(it.id)}
                          className="flex items-center gap-1 text-red-600 hover:text-red-800"
                        >
                          <Trash size={16} /> Usuń
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Karty mobilne */}
      <div className="md:hidden mt-6 space-y-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-white rounded-xl p-4 shadow flex flex-col gap-3">
                <div className="h-4 w-3/4 bg-gray-200 rounded" />
                <div className="flex justify-between">
                  <div className="h-4 w-1/4 bg-gray-200 rounded" />
                  <div className="h-4 w-16 bg-gray-200 rounded" />
                </div>
                <div className="h-3 w-full bg-gray-200 rounded" />
                <div className="flex gap-2">
                  <div className="h-8 w-20 bg-gray-200 rounded" />
                  <div className="h-8 w-20 bg-gray-200 rounded" />
                </div>
              </div>
            ))
          : filtered.length === 0
          ? (
            <div className="text-center text-gray-500 py-8 bg-white rounded-xl shadow">
              Brak produktów do wyświetlenia.
            </div>
          )
          : filtered.map((it) => (
              <div key={it.id} className="relative bg-white rounded-xl shadow p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="text-lg font-semibold">{it.name}</div>
                  <div className="text-sm font-medium text-gray-600">
                    {parseFloat(it.price || "0").toFixed(2)} zł
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {it.subcategory ? `${it.category} > ${it.subcategory}` : it.category}
                </div>
                {it.description && <div className="text-sm">{it.description}</div>}
                <div className="flex gap-2 flex-wrap justify-between items-center mt-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAvailability(it.id, it.available)}
                      disabled={togglingId === it.id}
                      className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                        it.available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      } ${togglingId === it.id ? "opacity-70 cursor-not-allowed" : "hover:scale-105"}`}
                    >
                      {it.available ? "Dostępny" : "Wyłączony"} <ToggleRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditing(it)}
                      className="text-indigo-600 flex items-center gap-1"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => deleteProduct(it.id)}
                      className="text-red-600 flex items-center gap-1"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
      </div>

      {editing && (
        <EditProductModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
