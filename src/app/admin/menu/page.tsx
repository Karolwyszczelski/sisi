// src/app/admin/menu/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useTheme } from "@/components/admin/ThemeContext";
import {
  Pencil, Trash2, Power, ChevronDown, RefreshCw, Search, Plus,
  Filter, ToggleLeft, ToggleRight, Package, Eye, Loader2,
  X, ImageIcon, Tag, Coins, FileText, List, Layers, Upload, Trash, Check
} from "lucide-react";
import debounce from "lodash.debounce";
import Image from "next/image";

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

interface Addon {
  id: string;
  name: string;
  price: number;
  category: "dodatek" | "sos" | "premium";
  available: boolean;
  display_order: number;
}

const supabase = createClientComponentClient();

const SUPABASE_BUCKET = "products";

/* ===================== Helper: Upload obrazka ===================== */
async function uploadProductImage(file: File, productId?: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${productId || "new"}-${Date.now()}.${ext}`;
  const filePath = `images/${fileName}`;

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(filePath, file, { 
      cacheControl: "3600", 
      upsert: true 
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/* ===================== Komponent uploadu obrazka ===================== */
function ImageUploader({
  imageUrl,
  onImageChange,
  isDark,
  productId,
}: {
  imageUrl: string;
  onImageChange: (url: string) => void;
  isDark: boolean;
  productId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Wybierz plik obrazka (jpg, png, webp)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Maksymalny rozmiar pliku to 5MB");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadProductImage(file, productId);
      onImageChange(url);
    } catch (err) {
      console.error("Błąd uploadu:", err);
      alert("Nie udało się przesłać obrazka");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const removeImage = () => {
    onImageChange("");
  };

  return (
    <div className="md:col-span-2">
      <label className={`flex items-center gap-2 text-sm font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-gray-700"}`}>
        <ImageIcon className="h-4 w-4" />
        Obrazek produktu
      </label>
      
      {imageUrl ? (
        <div className={`relative rounded-lg overflow-hidden border ${isDark ? "border-slate-600" : "border-gray-300"}`}>
          <div className="relative h-48 w-full">
            <Image
              src={imageUrl}
              alt="Podgląd produktu"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <div className={`absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center gap-3`}>
            <label className="flex items-center gap-2 px-4 py-2 bg-white/90 text-gray-800 rounded-lg cursor-pointer hover:bg-white transition">
              <Upload className="h-4 w-4" />
              Zmień
              <input
                type="file"
                accept="image/*"
                onChange={handleInputChange}
                className="hidden"
              />
            </label>
            <button
              onClick={removeImage}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              <Trash className="h-4 w-4" />
              Usuń
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center h-40 rounded-lg border-2 border-dashed cursor-pointer transition ${
            dragOver
              ? isDark ? "border-amber-500 bg-amber-500/10" : "border-amber-500 bg-amber-50"
              : isDark ? "border-slate-600 hover:border-slate-500 bg-slate-700/50" : "border-gray-300 hover:border-gray-400 bg-gray-50"
          }`}
        >
          {uploading ? (
            <Loader2 className={`h-8 w-8 animate-spin ${isDark ? "text-slate-400" : "text-gray-400"}`} />
          ) : (
            <>
              <Upload className={`h-8 w-8 mb-2 ${isDark ? "text-slate-400" : "text-gray-400"}`} />
              <span className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                Przeciągnij obrazek lub kliknij
              </span>
              <span className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                JPG, PNG, WebP (max 5MB)
              </span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

/* ===================== Modal edycji ===================== */
function EditProductModal({
  product,
  onClose,
  onSaved,
  isDark,
  allAddons,
}: {
  product: Product;
  onClose: () => void;
  onSaved: (p: Product) => void;
  isDark: boolean;
  allAddons: Addon[];
}) {
  const [form, setForm] = useState({
    name: product.name ?? "",
    price: product.price ?? "",
    description: product.description ?? "",
    category: product.category ?? "",
    subcategory: product.subcategory ?? "",
    ingredientsText: (product.ingredients ?? []).join(", "),
    image_url: product.image_url ?? "",
    selectedAddons: new Set<string>(product.available_addons ?? []),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const splitToArray = (txt: string) =>
    txt.split(/,|\n/).map((s) => s.trim()).filter(Boolean);

  const toggleAddon = (name: string) => {
    setForm((f) => {
      const newSet = new Set(f.selectedAddons);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return { ...f, selectedAddons: newSet };
    });
  };

  const selectAllCategory = (category: Addon["category"]) => {
    const names = allAddons.filter(a => a.category === category).map(a => a.name);
    setForm((f) => {
      const newSet = new Set(f.selectedAddons);
      names.forEach(n => newSet.add(n));
      return { ...f, selectedAddons: newSet };
    });
  };

  const deselectAllCategory = (category: Addon["category"]) => {
    const names = allAddons.filter(a => a.category === category).map(a => a.name);
    setForm((f) => {
      const newSet = new Set(f.selectedAddons);
      names.forEach(n => newSet.delete(n));
      return { ...f, selectedAddons: newSet };
    });
  };

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const payload = {
        name: form.name || null,
        price: form.price || null,
        description: form.description || null,
        category: form.category || null,
        subcategory: form.subcategory || null,
        ingredients: splitToArray(form.ingredientsText),
        image_url: form.image_url || null,
        available_addons: Array.from(form.selectedAddons),
      };

      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", product.id)
        .select("*")
        .single();

      if (error) throw error;
      onSaved(data as Product);
      onClose();
    } catch (e: unknown) {
      const error = e as Error;
      console.error("Błąd zapisu produktu:", error);
      setErr(error.message || "Nie udało się zapisać zmian.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `w-full rounded-lg px-4 py-2.5 transition focus:ring-2 ${
    isDark
      ? "bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
      : "bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20"
  }`;

  const labelClass = `flex items-center gap-2 text-sm font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-gray-700"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-xl sm:rounded-2xl shadow-2xl ${
        isDark ? "bg-slate-800" : "bg-white"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}>
          <h3 className={`text-lg sm:text-xl font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            <Pencil className="h-5 w-5 text-amber-500" />
            Edytuj produkt
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
          {err && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {err}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>
                <Tag className="h-4 w-4" />
                Nazwa
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                <Coins className="h-4 w-4" />
                Cena (zł)
              </label>
              <input
                value={form.price ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>
                <FileText className="h-4 w-4" />
                Opis
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={inputClass}
                rows={3}
              />
            </div>

            <div>
              <label className={labelClass}>
                <Layers className="h-4 w-4" />
                Kategoria
              </label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                <Layers className="h-4 w-4" />
                Podkategoria
              </label>
              <input
                value={form.subcategory}
                onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>
                <List className="h-4 w-4" />
                Składniki (oddzielaj przecinkiem)
              </label>
              <textarea
                value={form.ingredientsText}
                onChange={(e) => setForm((f) => ({ ...f, ingredientsText: e.target.value }))}
                className={inputClass}
                rows={2}
              />
            </div>

            {/* Dostępne dodatki - checkboxy */}
            <div className="md:col-span-2">
              <label className={labelClass}>
                <Plus className="h-4 w-4" />
                Dostępne dodatki dla tego produktu
              </label>
              
              {allAddons.length === 0 ? (
                <p className={`text-sm ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                  Brak dodatków w bazie. Dodaj je w sekcji Dodatki.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Dodatki standardowe */}
                  {allAddons.filter(a => a.category === "dodatek").length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                          Dodatki ({allAddons.filter(a => a.category === "dodatek" && form.selectedAddons.has(a.name)).length}/{allAddons.filter(a => a.category === "dodatek").length})
                        </span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => selectAllCategory("dodatek")} className={`text-xs px-2 py-0.5 rounded ${isDark ? "text-emerald-400 hover:bg-emerald-500/10" : "text-emerald-600 hover:bg-emerald-50"}`}>Zaznacz wszystkie</button>
                          <button type="button" onClick={() => deselectAllCategory("dodatek")} className={`text-xs px-2 py-0.5 rounded ${isDark ? "text-red-400 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50"}`}>Odznacz</button>
                        </div>
                      </div>
                      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}>
                        {allAddons.filter(a => a.category === "dodatek").map(addon => (
                          <label key={addon.id} className={`flex items-center gap-2 cursor-pointer text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                            <input
                              type="checkbox"
                              checked={form.selectedAddons.has(addon.name)}
                              onChange={() => toggleAddon(addon.name)}
                              className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                            />
                            <span>{addon.name}</span>
                            <span className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>{addon.price.toFixed(0)} zł</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Premium */}
                  {allAddons.filter(a => a.category === "premium").length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase ${isDark ? "text-purple-400" : "text-purple-600"}`}>
                          Premium ({allAddons.filter(a => a.category === "premium" && form.selectedAddons.has(a.name)).length}/{allAddons.filter(a => a.category === "premium").length})
                        </span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => selectAllCategory("premium")} className={`text-xs px-2 py-0.5 rounded ${isDark ? "text-emerald-400 hover:bg-emerald-500/10" : "text-emerald-600 hover:bg-emerald-50"}`}>Zaznacz</button>
                          <button type="button" onClick={() => deselectAllCategory("premium")} className={`text-xs px-2 py-0.5 rounded ${isDark ? "text-red-400 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50"}`}>Odznacz</button>
                        </div>
                      </div>
                      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}>
                        {allAddons.filter(a => a.category === "premium").map(addon => (
                          <label key={addon.id} className={`flex items-center gap-2 cursor-pointer text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                            <input
                              type="checkbox"
                              checked={form.selectedAddons.has(addon.name)}
                              onChange={() => toggleAddon(addon.name)}
                              className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                            />
                            <span>{addon.name}</span>
                            <span className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>{addon.price.toFixed(0)} zł</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sosy */}
                  {allAddons.filter(a => a.category === "sos").length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                          Sosy ({allAddons.filter(a => a.category === "sos" && form.selectedAddons.has(a.name)).length}/{allAddons.filter(a => a.category === "sos").length})
                        </span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => selectAllCategory("sos")} className={`text-xs px-2 py-0.5 rounded ${isDark ? "text-emerald-400 hover:bg-emerald-500/10" : "text-emerald-600 hover:bg-emerald-50"}`}>Zaznacz wszystkie</button>
                          <button type="button" onClick={() => deselectAllCategory("sos")} className={`text-xs px-2 py-0.5 rounded ${isDark ? "text-red-400 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50"}`}>Odznacz</button>
                        </div>
                      </div>
                      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}>
                        {allAddons.filter(a => a.category === "sos").map(addon => (
                          <label key={addon.id} className={`flex items-center gap-2 cursor-pointer text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                            <input
                              type="checkbox"
                              checked={form.selectedAddons.has(addon.name)}
                              onChange={() => toggleAddon(addon.name)}
                              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                            />
                            <span>{addon.name}</span>
                            <span className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>{addon.price.toFixed(0)} zł</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <ImageUploader
              imageUrl={form.image_url}
              onImageChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              isDark={isDark}
              productId={product.id}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2.5 rounded-lg font-medium transition w-full sm:w-auto ${
              isDark ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
            }`}
          >
            Anuluj
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition disabled:opacity-50 w-full sm:w-auto"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Zapisz zmiany
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Modal dodawania ===================== */
function AddProductModal({
  onClose,
  onSaved,
  isDark,
  allAddons,
}: {
  onClose: () => void;
  onSaved: (p: Product) => void;
  isDark: boolean;
  allAddons: Addon[];
}) {
  const [form, setForm] = useState({
    name: "",
    price: "",
    description: "",
    category: "",
    subcategory: "",
    ingredientsText: "",
    image_url: "",
    selectedAddons: new Set<string>(),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const splitToArray = (txt: string) =>
    txt.split(/,|\n/).map((s) => s.trim()).filter(Boolean);

  const toggleAddon = (name: string) => {
    setForm((f) => {
      const newSet = new Set(f.selectedAddons);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return { ...f, selectedAddons: newSet };
    });
  };

  const selectAllCategory = (category: Addon["category"]) => {
    const names = allAddons.filter(a => a.category === category).map(a => a.name);
    setForm((f) => {
      const newSet = new Set(f.selectedAddons);
      names.forEach(n => newSet.add(n));
      return { ...f, selectedAddons: newSet };
    });
  };

  const deselectAllCategory = (category: Addon["category"]) => {
    const names = allAddons.filter(a => a.category === category).map(a => a.name);
    setForm((f) => {
      const newSet = new Set(f.selectedAddons);
      names.forEach(n => newSet.delete(n));
      return { ...f, selectedAddons: newSet };
    });
  };

  const save = async () => {
    setErr(null);
    if (!form.name.trim()) {
      setErr("Nazwa produktu jest wymagana");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name || null,
        price: form.price || null,
        description: form.description || null,
        category: form.category || null,
        subcategory: form.subcategory || null,
        ingredients: splitToArray(form.ingredientsText),
        image_url: form.image_url || null,
        available_addons: Array.from(form.selectedAddons),
        available: true,
      };

      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;
      onSaved(data as Product);
      onClose();
    } catch (e: unknown) {
      const error = e as Error;
      console.error("Błąd dodawania produktu:", error);
      setErr(error.message || "Nie udało się dodać produktu.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `w-full rounded-lg px-4 py-2.5 transition focus:ring-2 ${
    isDark
      ? "bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
      : "bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20"
  }`;

  const labelClass = `flex items-center gap-2 text-sm font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-gray-700"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-xl sm:rounded-2xl shadow-2xl ${
        isDark ? "bg-slate-800" : "bg-white"
      }`}>
        <div className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}>
          <h3 className={`text-lg sm:text-xl font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            <Plus className="h-5 w-5 text-emerald-500" />
            Nowy produkt
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
          {err && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {err}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}><Tag className="h-4 w-4" />Nazwa *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
                placeholder="Np. Cheeseburger"
              />
            </div>
            <div>
              <label className={labelClass}><Coins className="h-4 w-4" />Cena (zł)</label>
              <input
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className={inputClass}
                placeholder="28.00"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}><FileText className="h-4 w-4" />Opis</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={inputClass}
                rows={2}
                placeholder="Opcjonalny opis produktu..."
              />
            </div>
            <div>
              <label className={labelClass}><Layers className="h-4 w-4" />Kategoria</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={inputClass}
                placeholder="Burger"
              />
            </div>
            <div>
              <label className={labelClass}><Layers className="h-4 w-4" />Podkategoria</label>
              <input
                value={form.subcategory}
                onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
                className={inputClass}
                placeholder="100% Wołowina"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}><List className="h-4 w-4" />Składniki</label>
              <textarea
                value={form.ingredientsText}
                onChange={(e) => setForm((f) => ({ ...f, ingredientsText: e.target.value }))}
                className={inputClass}
                rows={2}
                placeholder="wołowina, ser, sałata..."
              />
            </div>
            
            {/* ===== Checkboxy dodatków ===== */}
            <div className="md:col-span-2">
              <label className={labelClass}><List className="h-4 w-4" />Dostępne dodatki</label>
              
              {allAddons.length === 0 ? (
                <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                  Brak dodatków w bazie. Dodaj je w zakładce &quot;Dodatki&quot;.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Kategoria: Dodatki */}
                  {allAddons.filter(a => a.category === "dodatek").length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                          Dodatki (4 zł)
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => selectAllCategory("dodatek")}
                            className="text-xs text-amber-500 hover:text-amber-400"
                          >
                            Zaznacz wszystkie
                          </button>
                          <span className={isDark ? "text-slate-600" : "text-gray-300"}>|</span>
                          <button
                            type="button"
                            onClick={() => deselectAllCategory("dodatek")}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Odznacz
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {allAddons.filter(a => a.category === "dodatek").map((addon) => (
                          <label
                            key={addon.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
                              form.selectedAddons.has(addon.name)
                                ? isDark
                                  ? "bg-amber-500/20 border border-amber-500/50"
                                  : "bg-amber-50 border border-amber-300"
                                : isDark
                                  ? "bg-slate-700/50 border border-slate-600 hover:border-slate-500"
                                  : "bg-gray-50 border border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={form.selectedAddons.has(addon.name)}
                              onChange={() => toggleAddon(addon.name)}
                              className="sr-only"
                            />
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                              form.selectedAddons.has(addon.name)
                                ? "bg-amber-500 border-amber-500"
                                : isDark ? "border-slate-500" : "border-gray-400"
                            }`}>
                              {form.selectedAddons.has(addon.name) && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className={`text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>{addon.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Kategoria: Premium */}
                  {allAddons.filter(a => a.category === "premium").length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-purple-400" : "text-purple-600"}`}>
                          Premium (płynny ser itp.)
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => selectAllCategory("premium")}
                            className="text-xs text-amber-500 hover:text-amber-400"
                          >
                            Zaznacz wszystkie
                          </button>
                          <span className={isDark ? "text-slate-600" : "text-gray-300"}>|</span>
                          <button
                            type="button"
                            onClick={() => deselectAllCategory("premium")}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Odznacz
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {allAddons.filter(a => a.category === "premium").map((addon) => (
                          <label
                            key={addon.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
                              form.selectedAddons.has(addon.name)
                                ? isDark
                                  ? "bg-purple-500/20 border border-purple-500/50"
                                  : "bg-purple-50 border border-purple-300"
                                : isDark
                                  ? "bg-slate-700/50 border border-slate-600 hover:border-slate-500"
                                  : "bg-gray-50 border border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={form.selectedAddons.has(addon.name)}
                              onChange={() => toggleAddon(addon.name)}
                              className="sr-only"
                            />
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                              form.selectedAddons.has(addon.name)
                                ? "bg-purple-500 border-purple-500"
                                : isDark ? "border-slate-500" : "border-gray-400"
                            }`}>
                              {form.selectedAddons.has(addon.name) && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className={`text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>{addon.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Kategoria: Sosy */}
                  {allAddons.filter(a => a.category === "sos").length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                          Sosy (3 zł)
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => selectAllCategory("sos")}
                            className="text-xs text-amber-500 hover:text-amber-400"
                          >
                            Zaznacz wszystkie
                          </button>
                          <span className={isDark ? "text-slate-600" : "text-gray-300"}>|</span>
                          <button
                            type="button"
                            onClick={() => deselectAllCategory("sos")}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Odznacz
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {allAddons.filter(a => a.category === "sos").map((addon) => (
                          <label
                            key={addon.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
                              form.selectedAddons.has(addon.name)
                                ? isDark
                                  ? "bg-emerald-500/20 border border-emerald-500/50"
                                  : "bg-emerald-50 border border-emerald-300"
                                : isDark
                                  ? "bg-slate-700/50 border border-slate-600 hover:border-slate-500"
                                  : "bg-gray-50 border border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={form.selectedAddons.has(addon.name)}
                              onChange={() => toggleAddon(addon.name)}
                              className="sr-only"
                            />
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                              form.selectedAddons.has(addon.name)
                                ? "bg-emerald-500 border-emerald-500"
                                : isDark ? "border-slate-500" : "border-gray-400"
                            }`}>
                              {form.selectedAddons.has(addon.name) && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className={`text-sm ${isDark ? "text-slate-200" : "text-gray-700"}`}>{addon.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <ImageUploader
              imageUrl={form.image_url}
              onImageChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              isDark={isDark}
            />
          </div>
        </div>

        <div className={`flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2.5 rounded-lg font-medium transition w-full sm:w-auto ${
              isDark ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
            }`}
          >
            Anuluj
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition disabled:opacity-50 w-full sm:w-auto"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Dodaj produkt
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Strona ===================== */
export default function AdminMenuPage() {
  const { isDark } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [allAddons, setAllAddons] = useState<Addon[]>([]);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterAvailable, setFilterAvailable] = useState<"all" | "available" | "unavailable">("all");
  const [sortKey, setSortKey] = useState<"nameAsc" | "nameDesc" | "priceAsc" | "priceDesc">("nameAsc");
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);

  // Globalny status zamawiania
  const [orderingOpen, setOrderingOpen] = useState<boolean | null>(null);
  const [toggleOrderingBusy, setToggleOrderingBusy] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, ri, { data: addonsData }] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .order("category", { ascending: true })
          .order("subcategory", { ascending: true })
          .order("name", { ascending: true }),
        supabase.from("restaurant_info").select("ordering_open").eq("id", 1).maybeSingle(),
        supabase
          .from("addons")
          .select("*")
          .order("display_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);

      setProducts((data as Product[]) ?? []);
      setAllAddons((addonsData as Addon[]) ?? []);
      if (!ri.error && ri.data) setOrderingOpen(Boolean((ri.data as { ordering_open: boolean }).ordering_open));
    } catch (e) {
      console.error("Błąd pobierania:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();

    const chProducts = supabase
      .channel("products-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, fetchProducts)
      .subscribe();

    const chRestaurant = supabase
      .channel("restaurant-info-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_info", filter: "id=eq.1" }, (p) => {
        const row = (p as { new?: { ordering_open?: boolean } }).new;
        if (row && typeof row.ordering_open === "boolean") {
          setOrderingOpen(row.ordering_open);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chProducts);
      supabase.removeChannel(chRestaurant);
    };
  }, [fetchProducts]);

  const toggleAvailability = async (id: string, current: boolean) => {
    setTogglingId(id);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, available: !current } : p)));
    try {
      const { error } = await supabase.from("products").update({ available: !current }).eq("id", id);
      if (error) {
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, available: current } : p)));
      }
    } catch {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, available: current } : p)));
    } finally {
      setTogglingId(null);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Na pewno usunąć ten produkt?")) return;
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (!error) setProducts((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      console.error("Błąd usuwania:", e);
    }
  };

  const flipOrdering = async () => {
    if (orderingOpen == null) return;
    setToggleOrderingBusy(true);
    try {
      const next = !orderingOpen;
      setOrderingOpen(next);
      const { error } = await supabase.from("restaurant_info").update({ ordering_open: next }).eq("id", 1);
      if (error) setOrderingOpen(!next);
    } catch {
      setOrderingOpen((v) => !v);
    } finally {
      setToggleOrderingBusy(false);
    }
  };

  /* Kategorie do filtra */
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.subcategory) cats.add(`${p.category} > ${p.subcategory}`);
      cats.add(p.category || "Bez kategorii");
    });
    return Array.from(cats).sort();
  }, [products]);

  /* Filtrowanie + sort + search */
  const filtered = useMemo(() => {
    return products
      .filter((p) => {
        // Filtr kategorii
        if (filterCat !== "all") {
          if (p.subcategory) {
            if (`${p.category} > ${p.subcategory}` !== filterCat && p.category !== filterCat) return false;
          } else if ((p.category || "Bez kategorii") !== filterCat) return false;
        }
        // Filtr dostępności
        if (filterAvailable === "available" && !p.available) return false;
        if (filterAvailable === "unavailable" && p.available) return false;
        // Wyszukiwanie
        if (search.trim()) {
          const term = search.toLowerCase();
          return (p.name || "").toLowerCase().includes(term) || (p.description || "").toLowerCase().includes(term);
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortKey) {
          case "nameAsc": return (a.name || "").localeCompare(b.name || "");
          case "nameDesc": return (b.name || "").localeCompare(a.name || "");
          case "priceAsc": return parseFloat(a.price || "0") - parseFloat(b.price || "0");
          case "priceDesc": return parseFloat(b.price || "0") - parseFloat(a.price || "0");
          default: return 0;
        }
      });
  }, [products, filterCat, filterAvailable, sortKey, search]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onSearchChange = useCallback(debounce((v: string) => setSearch(v), 300), []);

  const stats = useMemo(() => ({
    total: products.length,
    available: products.filter((p) => p.available).length,
    unavailable: products.filter((p) => !p.available).length,
  }), [products]);

  // Klasy pomocnicze
  const t = {
    bg: isDark ? "bg-slate-900" : "bg-gray-50",
    bgCard: isDark ? "bg-slate-800" : "bg-white",
    border: isDark ? "border-slate-700" : "border-gray-200",
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-slate-400" : "text-gray-500",
    textSubtle: isDark ? "text-slate-500" : "text-gray-400",
  };

  return (
    <div className={`min-h-screen ${t.bg} p-4 md:p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDark ? "bg-slate-800" : "bg-white border border-gray-200"}`}>
              <Package className={`h-6 w-6 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${t.text}`}>Zarządzanie Menu</h1>
              <p className={`text-sm ${t.textMuted}`}>
                {stats.total} produktów • {stats.available} dostępnych • {stats.unavailable} wyłączonych
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={fetchProducts}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
                isDark 
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700" 
                  : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-200"
              } disabled:opacity-50`}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Odśwież
            </button>

            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition"
            >
              <Plus className="h-4 w-4" />
              Dodaj produkt
            </button>
          </div>
        </div>

        {/* Filtry */}
        <div className={`rounded-xl p-4 mb-6 ${t.bgCard} border ${t.border}`}>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className={`flex items-center gap-2 text-xs font-medium mb-1.5 uppercase ${t.textMuted}`}>
                <Search className="h-3.5 w-3.5" />
                Szukaj
              </label>
              <input
                type="text"
                placeholder="Nazwa lub opis..."
                onChange={(e) => onSearchChange(e.target.value)}
                className={`w-full rounded-lg px-4 py-2.5 transition ${
                  isDark
                    ? "bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400"
                    : "bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400"
                }`}
              />
            </div>

            <div className="min-w-[180px]">
              <label className={`flex items-center gap-2 text-xs font-medium mb-1.5 uppercase ${t.textMuted}`}>
                <Filter className="h-3.5 w-3.5" />
                Kategoria
              </label>
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
                className={`w-full rounded-lg px-4 py-2.5 transition appearance-none ${
                  isDark
                    ? "bg-slate-700 border border-slate-600 text-white"
                    : "bg-white border border-gray-300 text-gray-900"
                }`}
              >
                <option value="all">Wszystkie</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="min-w-[150px]">
              <label className={`flex items-center gap-2 text-xs font-medium mb-1.5 uppercase ${t.textMuted}`}>
                <Eye className="h-3.5 w-3.5" />
                Dostępność
              </label>
              <select
                value={filterAvailable}
                onChange={(e) => setFilterAvailable(e.target.value as "all" | "available" | "unavailable")}
                className={`w-full rounded-lg px-4 py-2.5 transition appearance-none ${
                  isDark
                    ? "bg-slate-700 border border-slate-600 text-white"
                    : "bg-white border border-gray-300 text-gray-900"
                }`}
              >
                <option value="all">Wszystkie</option>
                <option value="available">✓ Dostępne</option>
                <option value="unavailable">✗ Wyłączone</option>
              </select>
            </div>

            <div className="min-w-[140px]">
              <label className={`flex items-center gap-2 text-xs font-medium mb-1.5 uppercase ${t.textMuted}`}>
                <ChevronDown className="h-3.5 w-3.5" />
                Sortuj
              </label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                className={`w-full rounded-lg px-4 py-2.5 transition appearance-none ${
                  isDark
                    ? "bg-slate-700 border border-slate-600 text-white"
                    : "bg-white border border-gray-300 text-gray-900"
                }`}
              >
                <option value="nameAsc">Nazwa ↑</option>
                <option value="nameDesc">Nazwa ↓</option>
                <option value="priceAsc">Cena ↑</option>
                <option value="priceDesc">Cena ↓</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className={`rounded-xl overflow-hidden border ${t.border} ${t.bgCard}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isDark ? "bg-slate-700/50" : "bg-gray-50"}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${t.textMuted}`}>#</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${t.textMuted}`}>Nazwa</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${t.textMuted}`}>Cena</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${t.textMuted} hidden md:table-cell`}>Kategoria</th>
                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase ${t.textMuted}`}>Dostępność</th>
                  <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${t.textMuted}`}>Akcje</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-slate-700/50" : "divide-gray-100"}`}>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4"><div className={`h-4 w-6 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} /></td>
                      <td className="px-4 py-4"><div className={`h-4 w-40 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} /></td>
                      <td className="px-4 py-4"><div className={`h-4 w-16 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} /></td>
                      <td className="px-4 py-4 hidden md:table-cell"><div className={`h-4 w-32 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} /></td>
                      <td className="px-4 py-4 text-center"><div className={`h-6 w-20 rounded-full mx-auto ${isDark ? "bg-slate-700" : "bg-gray-200"}`} /></td>
                      <td className="px-4 py-4 text-right"><div className={`h-4 w-24 rounded ml-auto ${isDark ? "bg-slate-700" : "bg-gray-200"}`} /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`px-4 py-12 text-center ${t.textMuted}`}>
                      Brak produktów do wyświetlenia.
                    </td>
                  </tr>
                ) : (
                  filtered.map((it, i) => (
                    <tr 
                      key={it.id} 
                      className={`transition ${
                        !it.available 
                          ? isDark ? "bg-slate-800/30 opacity-60" : "bg-gray-50/50 opacity-60"
                          : isDark ? "hover:bg-slate-700/30" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className={`px-4 py-3 text-sm font-medium ${t.textMuted}`}>{i + 1}</td>
                      <td className={`px-4 py-3 ${t.text}`}>
                        <div className="font-medium">{it.name}</div>
                        {it.description && (
                          <div className={`text-xs mt-0.5 ${t.textSubtle} line-clamp-1`}>{it.description}</div>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                        {parseFloat(it.price || "0").toFixed(2)} zł
                      </td>
                      <td className={`px-4 py-3 text-sm ${t.textMuted} hidden md:table-cell`}>
                        {it.subcategory ? `${it.category} > ${it.subcategory}` : it.category || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleAvailability(it.id, it.available)}
                          disabled={togglingId === it.id}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                            it.available
                              ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                              : isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
                          } ${togglingId === it.id ? "opacity-50" : "hover:scale-105"}`}
                        >
                          {it.available ? (
                            <>Dostępny <ToggleRight className="h-4 w-4" /></>
                          ) : (
                            <>Wyłączony <ToggleLeft className="h-4 w-4" /></>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditing(it)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition ${
                              isDark
                                ? "text-blue-400 hover:bg-blue-500/10"
                                : "text-blue-600 hover:bg-blue-50"
                            }`}
                          >
                            <Pencil className="h-4 w-4" />
                            Edytuj
                          </button>
                          <button
                            onClick={() => deleteProduct(it.id)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition ${
                              isDark
                                ? "text-red-400 hover:bg-red-500/10"
                                : "text-red-600 hover:bg-red-50"
                            }`}
                          >
                            <Trash2 className="h-4 w-4" />
                            Usuń
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Podsumowanie */}
        <div className={`mt-4 text-sm ${t.textMuted}`}>
          Wyświetlono {filtered.length} z {products.length} produktów
        </div>

        {/* Widok mobilny - karty */}
        <div className="md:hidden mt-6 space-y-3">
          {!loading && filtered.map((it) => (
            <div 
              key={it.id} 
              className={`rounded-xl p-4 ${t.bgCard} border ${t.border} ${!it.available ? "opacity-60" : ""}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className={`font-semibold ${t.text}`}>{it.name}</div>
                <div className={`text-sm font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                  {parseFloat(it.price || "0").toFixed(2)} zł
                </div>
              </div>
              <div className={`text-xs mb-2 ${t.textMuted}`}>
                {it.subcategory ? `${it.category} > ${it.subcategory}` : it.category}
              </div>
              {it.description && (
                <div className={`text-sm mb-3 ${t.textSubtle} line-clamp-2`}>{it.description}</div>
              )}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleAvailability(it.id, it.available)}
                  disabled={togglingId === it.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    it.available
                      ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                      : isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
                  }`}
                >
                  {it.available ? "Dostępny" : "Wyłączony"}
                  {it.available ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(it)}
                    className={`p-2 rounded-lg ${isDark ? "text-blue-400 hover:bg-blue-500/10" : "text-blue-600 hover:bg-blue-50"}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteProduct(it.id)}
                    className={`p-2 rounded-lg ${isDark ? "text-red-400 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modale */}
      {editing && (
        <EditProductModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setEditing(null);
          }}
          isDark={isDark}
          allAddons={allAddons}
        />
      )}

      {adding && (
        <AddProductModal
          onClose={() => setAdding(false)}
          onSaved={(newProduct) => {
            setProducts((prev) => [...prev, newProduct]);
            setAdding(false);
          }}
          isDark={isDark}
          allAddons={allAddons}
        />
      )}
    </div>
  );
}
