"use client";

import React, { useState, useEffect } from "react";
import productsData from "@/data/product.json";

// Funkcja spłaszczająca strukturę danych z product.json
function flattenProducts(data: any[]): { name: string; price: number }[] {
  let products: { name: string; price: number }[] = [];
  data.forEach((category) => {
    if (category.subcategories) {
      category.subcategories.forEach((subcat: any) => {
        if (subcat.items) {
          products = products.concat(
            subcat.items.map((item: any) => ({
              name: item.name,
              price: item.price,
            }))
          );
        }
      });
    }
    if (category.items) {
      products = products.concat(
        category.items.map((item: any) => ({
          name: item.name,
          price: item.price,
        }))
      );
    }
  });
  return products;
}

const MENU_PRODUCTS = flattenProducts(productsData);

// Funkcja normalizująca nazwy – usuwa spacje, diakrytyki i zmienia na małe litery
function normalizeName(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

export interface Product {
  name: string;
  price: number;
  quantity: number; // Ilość burgerów
  meatType?: "wołowina" | "kurczak";
  addons?: string[];
  extraMeatCount?: number; // Ilość dodatkowego mięsa
  note?: string;
}

interface EditOrderButtonProps {
  orderId: string;
  currentProducts: Product[];
  currentSelectedOption: "local" | "takeaway" | "delivery";
  onOrderUpdated: (orderId: string, updatedData?: Partial<any>) => void;
}

const ALL_ADDONS = [
  "Ser",
  "Bekon",
  "Jalapeño",
  "Ogórek",
  "Rukola",
  "Czerwona cebula",
  "Pomidor",
  "Pikle",
  "Nachosy",
  "Konfitura z cebuli",
  "Gruszka",
  "Płynny ser",
];

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
}: EditOrderButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedOption, setSelectedOption] = useState<"local" | "takeaway" | "delivery">(currentSelectedOption);
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Inicjalizacja stanu lokalnego przy otwarciu modala
  useEffect(() => {
    if (showModal) {
      setProducts(
        currentProducts.map((item) => {
          const found = MENU_PRODUCTS.find(
            (p) => normalizeName(p.name) === normalizeName(item.name)
          );
          if (!found) {
            console.warn("Nie znaleziono ceny dla produktu:", item.name);
          }
          return {
            ...item,
            quantity: item.quantity !== undefined ? item.quantity : 1,
            extraMeatCount: item.extraMeatCount !== undefined ? item.extraMeatCount : 0,
            addons: item.addons || [],
            meatType: item.meatType || "wołowina",
            price: found?.price || 0,
          };
        })
      );
      setSelectedOption(currentSelectedOption);
    }
    // Nie dodajemy currentProducts ani currentSelectedOption do dependency, by nie nadpisywać lokalnych zmian
  }, [showModal]);

  const handleQuantityChange = (index: number, newValue: string) => {
    const qty = parseInt(newValue);
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, quantity: isNaN(qty) ? 1 : qty } : p))
    );
  };

  const handleExtraMeatChange = (index: number, newValue: string) => {
    const count = parseInt(newValue);
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, extraMeatCount: isNaN(count) ? 0 : count } : p))
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
      const addonsCost = (item.addons?.length || 0) * 3;
      const extraMeatCost = (item.extraMeatCount || 0) * 10;
      return acc + (item.price + addonsCost + extraMeatCost) * quantity;
    }, 0);
  };

  const getPackagingCost = () => {
    return selectedOption === "takeaway" || selectedOption === "delivery" ? 2 : 0;
  };

  const calculateTotalWithPackaging = () => {
    return calculateBaseTotal() + getPackagingCost();
  };

  // Dodaj nowy produkt z MENU_PRODUCTS
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
      },
    ]);
  };

  // Funkcja wysyłająca zmiany do serwera (PATCH do API)
  const handleSave = async () => {
    try {
      // Ważne: Wysyłamy pole "items" (zaktualizowaną listę produktów) jako JSON string
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
        setShowModal(false);
      } else {
        const result = await res.json();
        console.error("Błąd edycji zamówienia:", result.error);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  // Komponent do edycji pojedynczego produktu
  const ProductEditor = ({
    product,
    index,
  }: {
    product: Product;
    index: number;
  }) => {
    return (
      <div className="border p-3 mb-4 rounded-xl shadow-sm">
        <div className="flex justify-between">
          <p className="font-semibold">{product.name}</p>
          <span>{product.price.toFixed(2)} zł</span>
        </div>

        {/* Edycja rodzaju mięsa */}
        <div className="mt-2">
          <span className="font-semibold text-sm">Mięso:</span>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => handleMeatChange(index, "wołowina")}
              className={`px-2 py-1 text-xs rounded-full ${
                product.meatType === "wołowina"
                  ? "bg-yellow-300 font-bold"
                  : "bg-gray-200"
              }`}
            >
              Wołowina
            </button>
            <button
              onClick={() => handleMeatChange(index, "kurczak")}
              className={`px-2 py-1 text-xs rounded-full ${
                product.meatType === "kurczak"
                  ? "bg-yellow-300 font-bold"
                  : "bg-gray-200"
              }`}
            >
              Kurczak
            </button>
          </div>
        </div>

        {/* Edycja dodatków */}
        <div className="mt-2">
          <span className="font-semibold text-sm">Dodatki:</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {ALL_ADDONS.map((addon) => {
              const hasAddon = product.addons?.includes(addon);
              return (
                <button
                  key={addon}
                  onClick={() => toggleAddon(index, addon)}
                  className={`border text-xs px-2 py-1 rounded-full ${
                    hasAddon ? "bg-gray-800 text-white" : "bg-white text-black"
                  }`}
                >
                  {hasAddon ? `✓ ${addon}` : `+ ${addon}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Edycja dodatkowego mięsa */}
        <div className="mt-2 flex items-center gap-2">
          <label className="text-sm">Dodatkowe mięso:</label>
          <div className="flex items-center">
            <button
              onClick={() =>
                handleExtraMeatChange(index, String(Math.max(product.extraMeatCount - 1, 0)))
              }
              disabled={product.extraMeatCount <= 0}
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-black rounded-full"
            >
              -
            </button>
            <span className="mx-2">{product.extraMeatCount}</span>
            <button
              onClick={() =>
                handleExtraMeatChange(index, String(product.extraMeatCount + 1))
              }
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-black rounded-full"
            >
              +
            </button>
            <span className="text-xs text-gray-500 ml-2">x +10 zł</span>
          </div>
        </div>

        {/* Edycja ilości */}
        <div className="mt-2 flex items-center gap-2">
          <label className="text-sm">Ilość burgera:</label>
          <div className="flex items-center">
            <button
              onClick={() =>
                handleQuantityChange(index, String(Math.max(product.quantity - 1, 1)))
              }
              disabled={product.quantity <= 1}
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-black rounded-full"
            >
              -
            </button>
            <span className="mx-2">{product.quantity}</span>
            <button
              onClick={() =>
                handleQuantityChange(index, String(product.quantity + 1))
              }
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-black rounded-full"
            >
              +
            </button>
          </div>
        </div>

        <button
          onClick={() => handleRemoveProduct(index)}
          className="mt-3 bg-red-500 hover:bg-red-600 text-white px-3 py-1 text-sm rounded-full"
        >
          Usuń produkt
        </button>
      </div>
    );
  };

  return (
    <div>
      <button
        onClick={() => setShowModal(true)}
        className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-full"
      >
        Edytuj
      </button>
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
          <div className="bg-white p-6 rounded max-h-[90vh] overflow-y-auto w-full max-w-md">
            <h3 className="text-2xl font-bold mb-2">
              Zamówienie: {getOptionLabel(selectedOption)}
            </h3>
            <h4 className="text-xl font-bold mb-4">Edytuj zamówienie</h4>

            {/* Wybór sposobu odbioru */}
            <div className="flex gap-2 mb-4">
              {(["local", "takeaway", "delivery"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setSelectedOption(option)}
                  className={`px-3 py-1 rounded-full ${
                    selectedOption === option ? "bg-yellow-400 font-bold" : "bg-gray-200"
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

            {/* Lista produktów */}
            {products.map((product, index) => (
              <ProductEditor key={index} product={product} index={index} />
            ))}

            {/* Przycisk dodania nowego produktu */}
            <div className="mb-4">
              <button
                onClick={() => setShowAddProduct(true)}
                className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded-full"
              >
                Dodaj produkt
              </button>
            </div>

            {/* Modal dodawania produktu */}
            {showAddProduct && (
              <div className="mb-4 border p-4 rounded-lg">
                <h4 className="font-bold mb-2">Wybierz produkt</h4>
                <ul className="space-y-2">
                  {MENU_PRODUCTS.map((prod) => (
                    <li key={prod.name}>
                      <button
                        onClick={() => {
                          handleAddNewProduct(prod.name, prod.price);
                          setShowAddProduct(false);
                        }}
                        className="block w-full text-left px-3 py-2 border-b hover:bg-gray-100 rounded-full"
                      >
                        {prod.name} - {prod.price} zł
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowAddProduct(false)}
                  className="mt-2 text-red-500 text-sm rounded-full"
                >
                  Anuluj
                </button>
              </div>
            )}

            {/* Podsumowanie cen */}
            <div className="mt-4 text-sm space-y-1 border-t pt-2">
              <div className="flex justify-between">
                <span>Suma produktów:</span>
                <span>{calculateBaseTotal().toFixed(2)} zł</span>
              </div>
              {(selectedOption === "takeaway" || selectedOption === "delivery") && (
                <div className="flex justify-between">
                  <span>Opakowanie:</span>
                  <span>{getPackagingCost().toFixed(2)} zł</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                <span>Razem do zapłaty:</span>
                <span>{calculateTotalWithPackaging().toFixed(2)} zł</span>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-full"
              >
                Zapisz zmiany
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-full"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
