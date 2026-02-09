"use client";

import React, { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import productsData from "@/data/product.json";
import type { MenuItem } from "@/app/admin/menu/page";
import { useTheme } from "@/components/admin/ThemeContext";
import {
  Pencil, X, Tag, Coins, FileText, Layers, List,
  ImageIcon, Plus, Trash2, Upload, Save, Loader2
} from "lucide-react";

interface FormValues {
  name: string;
  price: number;
  category: string;
  subcategory?: string;
  description?: string;
  imageFile?: FileList;
  ingredients: { value: string }[];
}

interface Props {
  item: MenuItem;
  onClose(): void;
  onSave(item: MenuItem): void;
}

export default function EditMenuItemModal({ item, onClose, onSave }: Props) {
  const { isDark } = useTheme();
  const { register, handleSubmit, control, watch, reset } = useForm<FormValues>({
    defaultValues: {
      name: item.name,
      price: item.price,
      category: item.category,
      subcategory: item.subcategory,
      description: item.description,
      imageFile: undefined,
      ingredients: item.ingredients.map(v => ({ value: v })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "ingredients" });
  const selectedCat = watch("category");
  const [saving, setSaving] = useState(false);

  const [subcats, setSubcats] = useState<string[]>([]);
  useEffect(() => {
    reset({
      name: item.name,
      price: item.price,
      category: item.category,
      subcategory: item.subcategory,
      description: item.description,
      imageFile: undefined,
      ingredients: item.ingredients.map(v => ({ value: v })),
    });
  }, [item, reset]);

  useEffect(() => {
    const cat = productsData.find(c=>c.category===selectedCat);
    setSubcats(cat?.subcategories?.map(s=>s.name) ?? []);
  }, [selectedCat]);

  // podgląd
  const [preview, setPreview] = useState<string|null>(item.imageUrl ?? null);
  const [dragOver, setDragOver] = useState(false);
  const fileList = watch("imageFile");
  useEffect(()=>{
    if(fileList && fileList.length){
      const url = URL.createObjectURL(fileList[0]);
      setPreview(url);
      return ()=>URL.revokeObjectURL(url);
    }
  },[fileList]);

  const onSubmit = (data: FormValues) => {
    setSaving(true);
    onSave({
      ...item,
      name: data.name,
      price: data.price,
      category: data.category,
      subcategory: data.subcategory,
      description: data.description,
      imageUrl: preview ?? undefined,
      ingredients: data.ingredients.map(i=>i.value),
    });
    onClose();
  };

  const inputClass = `w-full rounded-xl px-4 py-3 transition focus:ring-2 focus:outline-none ${
    isDark
      ? "bg-slate-700/50 border border-slate-600 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
      : "bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20"
  }`;

  const labelClass = `flex items-center gap-2 text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
      <div className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl shadow-2xl ${
        isDark ? "bg-gradient-to-b from-slate-800 to-slate-900" : "bg-white"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-5 border-b ${
          isDark ? "border-slate-700/50 bg-slate-800/50" : "border-gray-100 bg-gray-50/50"
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/20">
              <Pencil className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Edytuj pozycję</h2>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2.5 rounded-xl transition ${isDark ? "hover:bg-slate-700 text-slate-400 hover:text-white" : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lewa kolumna - zdjęcie i składniki */}
            <div className="space-y-5">
              {/* Zdjęcie */}
              <div>
                <label className={labelClass}>
                  <ImageIcon className="h-4 w-4" />
                  Zdjęcie produktu
                </label>
                {preview ? (
                  <div className={`relative rounded-xl overflow-hidden border-2 ${
                    isDark ? "border-slate-600" : "border-gray-200"
                  }`}>
                    <img src={preview} className="w-full h-48 object-cover" alt="Podgląd"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-all flex items-end justify-center pb-4 gap-2">
                      <label className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm text-gray-800 rounded-lg cursor-pointer hover:bg-white transition text-sm font-medium">
                        <Upload className="h-4 w-4" />
                        Zmień
                        <input type="file" accept="image/png,image/jpeg,image/webp" {...register("imageFile")} className="hidden" />
                      </label>
                      <button
                        type="button"
                        onClick={() => setPreview(null)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/90 backdrop-blur-sm text-white rounded-lg hover:bg-red-600 transition text-sm font-medium"
                      >
                        <Trash2 className="h-4 w-4" />
                        Usuń
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    className={`flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                      dragOver
                        ? "border-amber-500 bg-amber-500/10 scale-[1.02]"
                        : isDark ? "border-slate-600 hover:border-slate-500 bg-slate-700/30" : "border-gray-200 hover:border-gray-300 bg-gray-50"
                    }`}
                  >
                    <div className={`p-3 rounded-full mb-3 ${isDark ? "bg-slate-600" : "bg-gray-100"}`}>
                      <Upload className={`h-6 w-6 ${isDark ? "text-slate-400" : "text-gray-400"}`} />
                    </div>
                    <span className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                      Przeciągnij lub kliknij
                    </span>
                    <span className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                      PNG, JPG, WebP
                    </span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" {...register("imageFile")} className="hidden" />
                  </label>
                )}
              </div>

              {/* Składniki */}
              <div>
                <label className={labelClass}>
                  <List className="h-4 w-4" />
                  Składniki
                </label>
                <div className={`rounded-xl p-4 space-y-2 ${isDark ? "bg-slate-700/30" : "bg-gray-50"}`}>
                  {fields.map((f,idx)=>(
                    <div key={f.id} className="flex items-center gap-2">
                      <input
                        {...register(`ingredients.${idx}.value` as const, { required: true })}
                        placeholder={`Składnik ${idx + 1}`}
                        className={`flex-1 rounded-lg px-3 py-2.5 text-sm transition ${isDark ? "bg-slate-600 border-none text-white placeholder:text-slate-400" : "bg-white border border-gray-200 text-gray-900"}`}
                      />
                      <button
                        type="button"
                        onClick={()=>remove(idx)}
                        className="p-2 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={()=>append({value:""})}
                    className={`flex items-center gap-2 w-full justify-center py-2.5 rounded-lg text-sm font-medium transition ${
                      isDark ? "text-amber-400 hover:bg-amber-500/10" : "text-amber-600 hover:bg-amber-50"
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
                <label className={labelClass}><Tag className="h-4 w-4" />Nazwa</label>
                <input {...register("name",{required:true})} className={inputClass} placeholder="Nazwa produktu"/>
              </div>

              <div>
                <label className={labelClass}><Coins className="h-4 w-4" />Cena (zł)</label>
                <input type="number" step="0.01" {...register("price",{required:true})} className={inputClass} placeholder="0.00"/>
              </div>

              <div>
                <label className={labelClass}><Layers className="h-4 w-4" />Kategoria</label>
                <select {...register("category",{required:true})} className={inputClass}>
                  <option value="">— wybierz kategorię —</option>
                  {productsData.map(c=><option key={c.category} value={c.category}>{c.category}</option>)}
                </select>
              </div>

              {subcats.length>0 && (
                <div>
                  <label className={labelClass}><Layers className="h-4 w-4" />Podkategoria</label>
                  <select {...register("subcategory")} className={inputClass}>
                    <option value="">— brak —</option>
                    {subcats.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className={labelClass}><FileText className="h-4 w-4" />Opis</label>
                <textarea {...register("description")} rows={4} className={inputClass} placeholder="Opcjonalny opis produktu..."/>
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
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold shadow-lg shadow-amber-500/25 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Zapisz zmiany
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
