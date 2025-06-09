"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import AddMenuItemModal from "@/components/admin/AddMenuItemModal";
import EditMenuItemModal from "@/components/admin/EditMenuItemModal";
import productsData from "@/data/product.json";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  subcategory?: string;
  description?: string;
  imageUrl?: string;
  available: boolean;
  ingredients: string[];
}

interface RawCategory {
  category: string;
  subcategories?: {
    name: string;
    items: {
      name: string;
      price: number;
      description?: string;
      ingredients?: string[];
    }[];
  }[];
  items?: {
    name: string;
    price: number;
    description?: string;
    ingredients?: string[];
  }[];
}

function flattenProducts(data: RawCategory[]): MenuItem[] {
  const items: MenuItem[] = [];
  data.forEach((cat) => {
    // pozycje w subkategoriach
    cat.subcategories?.forEach((sub) => {
      sub.items.forEach((it) => {
        items.push({
          id: `${cat.category} > ${sub.name} > ${it.name}`,
          name: it.name,
          price: it.price,
          category: cat.category,
          subcategory: sub.name,
          description: it.description,
          imageUrl: undefined,
          available: true,
          ingredients: it.ingredients ?? [],
        });
      });
    });
    // pozycje bez subkategorii
    cat.items?.forEach((it) => {
      items.push({
        id: `${cat.category} > ${it.name}`,
        name: it.name,
        price: it.price,
        category: cat.category,
        description: it.description,
        imageUrl: undefined,
        available: true,
        ingredients: it.ingredients ?? [],
      });
    });
  });
  return items;
}

export default function AdminMenuPage() {
  const supabase = createClientComponentClient();
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [displayed, setDisplayed] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filterCat, setFilterCat] = useState("Wszystkie");
  const [sortKey, setSortKey] = useState<"nameAsc"|"nameDesc"|"priceAsc"|"priceDesc">("nameAsc");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem|undefined>(undefined);

  // 1) załaduj z product.json
  useEffect(() => {
    const items = flattenProducts(productsData as RawCategory[]);
    setAllItems(items);
    // kategorie
    const cats = new Set<string>();
    items.forEach((it) => {
      cats.add(it.category);
      if (it.subcategory) cats.add(`${it.category} > ${it.subcategory}`);
    });
    setCategories(["Wszystkie", ...Array.from(cats)]);
  }, []);

  // 2) filtr + sortowanie
  useEffect(() => {
    let tmp = allItems;
    if (filterCat !== "Wszystkie") {
      tmp = tmp.filter((it) =>
        it.subcategory
          ? `${it.category} > ${it.subcategory}` === filterCat
          : it.category === filterCat
      );
    }
    tmp = [...tmp].sort((a,b) => {
      switch (sortKey) {
        case "nameAsc":   return a.name.localeCompare(b.name);
        case "nameDesc":  return b.name.localeCompare(a.name);
        case "priceAsc":  return a.price - b.price;
        case "priceDesc": return b.price - a.price;
      }
    });
    setDisplayed(tmp);
  }, [allItems, filterCat, sortKey]);

  // toggle dostępności
  const handleToggle = async (id: string) => {
    // znajdź bieżący stan
    const item = allItems.find((it) => it.id === id);
    if (!item) return;
    const newAvailable = !item.available;

    // zapisz w Supabase (tabela "menu_items" powinna mieć kolumnę "available")
    const { error } = await supabase
      .from("menu_items")
      .update({ available: newAvailable })
      .eq("id", id);
    if (error) {
      console.error("Błąd aktualizacji dostępności:", error);
      return;
    }

    // po sukcesie zaktualizuj stan lokalny
    setAllItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, available: newAvailable } : it
      )
    );
  };
  // usuń
  const handleDelete = (id: string) => {
    if (!confirm("Na pewno usunąć tę pozycję?")) return;
    setAllItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Zarządzanie Menu</h1>
        <button
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          + Dodaj pozycję
        </button>
      </div>

      <div className="flex gap-6 mb-4">
        <div>
          <label className="block text-sm font-medium">Kategoria:</label>
          <select
            className="mt-1 p-2 border rounded"
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Sortuj:</label>
          <select
            className="mt-1 p-2 border rounded"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
          >
            <option value="nameAsc">Nazwa ↑</option>
            <option value="nameDesc">Nazwa ↓</option>
            <option value="priceAsc">Cena ↑</option>
            <option value="priceDesc">Cena ↓</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto bg-white shadow rounded">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Nazwa</th>
              <th className="px-4 py-2">Cena</th>
              <th className="px-4 py-2">Kategoria</th>
              <th className="px-4 py-2">Dostępność</th>
              <th className="px-4 py-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((it, i) => (
              <tr key={it.id} className={i % 2 ? "bg-gray-50" : ""}>
                <td className="px-4 py-2">{i + 1}</td>
                <td className="px-4 py-2">{it.name}</td>
                <td className="px-4 py-2">{it.price} zł</td>
                <td className="px-4 py-2">
                  {it.subcategory ?? it.category}
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleToggle(it.id)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      it.available
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {it.available ? "Dostępny" : "Wyłączony"}
                  </button>
                </td>
                <td className="px-4 py-2 space-x-2">
                  <button
                    className="text-blue-600"
                    onClick={() => setEditItem(it)}
                  >
                    Edytuj
                  </button>
                  <button
                    className="text-red-600"
                    onClick={() => handleDelete(it.id)}
                  >
                    Usuń
                  </button>
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  Brak pozycji w menu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAddOpen && (
        <AddMenuItemModal
          onClose={() => setIsAddOpen(false)}
          onSave={(newItem) => {
            setAllItems((prev) => [...prev, newItem]);
            setIsAddOpen(false);
          }}
        />
      )}
      {editItem && (
        <EditMenuItemModal
          item={editItem}
          onClose={() => setEditItem(undefined)}
          onSave={(updated) => {
            setAllItems((prev) =>
              prev.map((it) => (it.id === updated.id ? updated : it))
            );
            setEditItem(undefined);
          }}
        />
      )}
    </div>
  );
}
