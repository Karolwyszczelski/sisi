// src/components/admin/AddMenuItemModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import productsData from "@/data/product.json";
import type { MenuItem } from "@/app/admin/menu/page";
import { useTheme } from "@/components/admin/ThemeContext";
import {
  Plus, X, Tag, Coins, FileText, Layers, List,
  Trash2, Save, Loader2, Sparkles
} from "lucide-react";

interface FormValues {
  name: string;
  price: number;
  category: string;
  subcategory?: string;
  description?: string;
  ingredients: { value: string }[];
}

interface Props {
  onClose(): void;
  onSave(item: MenuItem): void;
}

export default function AddMenuItemModal({ onClose, onSave }: Props) {
  const { isDark } = useTheme();
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, control, watch } = useForm<FormValues>({
    defaultValues: {
      name: "",
      price: 0,
      category: "",
      subcategory: "",
      description: "",
      ingredients: [{ value: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "ingredients",
  });

  // categories & dynamic subcats
  const allCats = productsData.map((c) => c.category);
  const selCat = watch("category");
  const subcats =
    productsData.find((c) => c.category === selCat)?.subcategories?.map((s) => s.name) ??
    [];

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    const payload = {
      name: data.name,
      price: data.price,
      category: data.category,
      subcategory: data.subcategory || null,
      description: data.description || null,
      ingredients: data.ingredients.map((i) => i.value),
    };
    const res = await fetch("/api/menu_items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      alert("Błąd zapisu: " + err.error);
      setSaving(false);
      return;
    }
    const created: MenuItem = await res.json();
    onSave(created);
    onClose();
  };

  const inputClass = `w-full rounded-xl px-4 py-3 transition focus:ring-2 focus:outline-none ${
    isDark
      ? "bg-slate-700/50 border border-slate-600 text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20"
      : "bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500/20"
  }`;

  const labelClass = `flex items-center gap-2 text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit(onSubmit)}
        className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl shadow-2xl ${
          isDark ? "bg-gradient-to-b from-slate-800 to-slate-900" : "bg-white"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-5 border-b ${
          isDark ? "border-slate-700/50 bg-slate-800/50" : "border-gray-100 bg-gray-50/50"
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Dodaj nową pozycję</h2>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>Wypełnij dane produktu</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2.5 rounded-xl transition ${isDark ? "hover:bg-slate-700 text-slate-400 hover:text-white" : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lewa kolumna - składniki */}
          <div className="space-y-5">
            <div>
              <label className={labelClass}>
                <List className="h-4 w-4" />
                Składniki
              </label>
              <div className={`rounded-xl p-4 space-y-2 ${isDark ? "bg-slate-700/30" : "bg-gray-50"}`}>
                {fields.map((f, idx) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <input
                      {...register(`ingredients.${idx}.value` as const, { required: true })}
                      placeholder={`Składnik ${idx + 1}`}
                      className={`flex-1 rounded-lg px-3 py-2.5 text-sm transition ${isDark ? "bg-slate-600 border-none text-white placeholder:text-slate-400" : "bg-white border border-gray-200 text-gray-900"}`}
                    />
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="p-2 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => append({ value: "" })}
                  className={`flex items-center gap-2 w-full justify-center py-2.5 rounded-lg text-sm font-medium transition ${
                    isDark ? "text-emerald-400 hover:bg-emerald-500/10" : "text-emerald-600 hover:bg-emerald-50"
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Dodaj składnik
                </button>
              </div>
            </div>
          </div>

          {/* Prawa kolumna - pola */}
          <div className="space-y-5">
            <div>
              <label className={labelClass}><Tag className="h-4 w-4" />Nazwa *</label>
              <input
                {...register("name", { required: true })}
                className={inputClass}
                placeholder="Np. Burger Classic"
              />
            </div>

            <div>
              <label className={labelClass}><Coins className="h-4 w-4" />Cena (zł)</label>
              <input
                type="number"
                step="0.01"
                {...register("price", { required: true, min: 0 })}
                className={inputClass}
                placeholder="28.00"
              />
            </div>

            <div>
              <label className={labelClass}><Layers className="h-4 w-4" />Kategoria *</label>
              <input
                list="cat-list"
                {...register("category", { required: true })}
                className={inputClass}
                placeholder="Wybierz lub wpisz nową"
              />
              <datalist id="cat-list">
                {allCats.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className={labelClass}><Layers className="h-4 w-4" />Podkategoria</label>
              <input
                list="subcat-list"
                {...register("subcategory")}
                className={inputClass}
                placeholder={subcats.length ? "Wybierz lub wpisz nową" : "Brak podkategorii"}
                disabled={!selCat}
              />
              <datalist id="subcat-list">
                {subcats.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className={labelClass}><FileText className="h-4 w-4" />Opis</label>
              <textarea
                {...register("description")}
                rows={3}
                className={inputClass}
                placeholder="Opcjonalny opis produktu..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-3 px-6 py-5 border-t ${
          isDark ? "border-slate-700/50 bg-slate-800/30" : "border-gray-100 bg-gray-50/50"
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2.5 rounded-xl font-medium transition ${isDark ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Zapisz produkt
          </button>
        </div>
      </form>
    </div>
  );
}
