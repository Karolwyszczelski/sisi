"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useTheme } from "@/components/admin/ThemeContext";
import {
  Flame,
  Save,
  Loader2,
  ImageIcon,
  Upload,
  Trash,
  RefreshCw,
  Tag,
  FileText,
  Coins,
  Check,
  AlertCircle,
} from "lucide-react";

export default function BurgerMonthPage() {
  const { isDark } = useTheme();
  const supabase = createClientComponentClient();

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "36.90",
    image_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Image upload states
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Pobierz dane z burger_of_month
      const { data: bomData, error: bomError } = await supabase
        .from("burger_of_month")
        .select("*")
        .eq("id", "current")
        .single();

      // Pobierz dane produktu "Burger Miesiąca" (id=12)
      const { data: productData } = await supabase
        .from("products")
        .select("*")
        .eq("id", "12")
        .single();

      console.log("DEBUG burger_of_month:", bomData);
      console.log("DEBUG products id=12:", productData);

      if (bomError && bomError.code !== "PGRST116") {
        throw bomError;
      }

      // Domyślne zdjęcie jeśli brak w bazie
      const defaultImage = "/halloween.svg";

      if (bomData) {
        setForm({
          name: bomData.name || "",
          description: bomData.description || "",
          price: productData?.price || "36.90",
          image_url: bomData.image_url || productData?.image_url || defaultImage,
        });
        setLastUpdated(bomData.updated_at || null);
      } else if (productData) {
        setForm({
          name: "",
          description: productData.description || "",
          price: productData.price || "36.90",
          image_url: productData.image_url || defaultImage,
        });
      }
    } catch (e) {
      console.error("Błąd pobierania:", e);
      setError("Nie udało się pobrać danych");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    setSaved(false);

    try {
      // 1. Zapisz do burger_of_month
      const { error: bomError } = await supabase
        .from("burger_of_month")
        .upsert(
          {
            id: "current",
            name: form.name,
            description: form.description,
            image_url: form.image_url,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (bomError) throw bomError;

      // 2. Zaktualizuj produkt "Burger Miesiąca" (id=12) w products
      const { error: productError } = await supabase
        .from("products")
        .update({
          description: `${form.name} - ${form.description}`,
          price: form.price,
          image_url: form.image_url,
        })
        .eq("id", "12");

      if (productError) throw productError;

      setSaved(true);
      setLastUpdated(new Date().toISOString());
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error("Błąd zapisu:", e);
      setError("Nie udało się zapisać zmian");
    } finally {
      setSaving(false);
    }
  };

  // Image upload
  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Plik musi być obrazem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Maksymalny rozmiar pliku to 5MB");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const ext = file.name.split(".").pop();
      const fileName = `burger-miesiaca-${Date.now()}.${ext}`;
      const filePath = `images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("products")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${filePath}`;
      setForm((f) => ({ ...f, image_url: publicUrl }));
    } catch (e) {
      console.error("Błąd uploadu:", e);
      setError("Nie udało się wgrać zdjęcia");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadImage(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
  };

  const removeImage = () => {
    setForm((f) => ({ ...f, image_url: "" }));
  };

  // Theme classes
  const t = {
    bg: isDark ? "bg-slate-900" : "bg-gray-50",
    bgCard: isDark ? "bg-slate-800" : "bg-white",
    border: isDark ? "border-slate-700" : "border-gray-200",
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-slate-400" : "text-gray-500",
    input: `w-full rounded-xl px-4 py-3 transition focus:ring-2 ${
      isDark
        ? "bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
        : "bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20"
    }`,
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center`}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className={t.textMuted}>Ładowanie...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.bg} p-6`}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className={`rounded-2xl ${t.bgCard} border ${t.border} p-6 mb-6`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
                <Flame className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${t.text}`}>Burger Miesiąca</h1>
                <p className={`text-sm ${t.textMuted}`}>
                  Edytuj aktualny burger specjalny
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
                  isDark
                    ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Odśwież
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saved ? "Zapisano!" : "Zapisz zmiany"}
              </button>
            </div>
          </div>

          {lastUpdated && (
            <p className={`mt-4 text-xs ${t.textMuted}`}>
              Ostatnia aktualizacja: {new Date(lastUpdated).toLocaleString("pl-PL")}
            </p>
          )}
        </div>

        {/* Error alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Success alert */}
        {saved && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
            <Check className="h-5 w-5 text-emerald-400" />
            <p className="text-sm text-emerald-400">
              Zmiany zostały zapisane! Burger miesiąca zaktualizowany w menu.
            </p>
          </div>
        )}

        {/* Form */}
        <div className={`rounded-2xl ${t.bgCard} border ${t.border} p-6`}>
          <div className="space-y-6">
            {/* Nazwa */}
            <div>
              <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${t.textMuted}`}>
                <Tag className="h-4 w-4" />
                Nazwa burgera *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={t.input}
                placeholder="Np. Chorizo, BBQ Bacon..."
              />
            </div>

            {/* Cena */}
            <div>
              <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${t.textMuted}`}>
                <Coins className="h-4 w-4" />
                Cena (zł)
              </label>
              <input
                type="text"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className={t.input}
                placeholder="36.90"
              />
            </div>

            {/* Opis */}
            <div>
              <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${t.textMuted}`}>
                <FileText className="h-4 w-4" />
                Opis / składniki
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={`${t.input} min-h-[200px] resize-y`}
                placeholder="🍔 puszystą bułkę&#10;🍔 ser cheddar&#10;🍔 soczystą wołowinę..."
              />
              <p className={`mt-2 text-xs ${t.textMuted}`}>
                Możesz używać emoji 🍔 dla lepszej prezentacji na stronie
              </p>
            </div>

            {/* Zdjęcie */}
            <div>
              <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${t.textMuted}`}>
                <ImageIcon className="h-4 w-4" />
                Zdjęcie burgera
              </label>

              {form.image_url ? (
                <div className="relative">
                  <div className={`relative rounded-xl overflow-hidden border ${t.border}`}>
                    <img
                      src={form.image_url}
                      alt="Burger miesiąca"
                      className="w-full h-64 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                      <span className="text-white text-sm font-medium bg-black/30 px-3 py-1 rounded-lg backdrop-blur-sm">
                        {form.name || "Burger Miesiąca"}
                      </span>
                      <button
                        onClick={removeImage}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Zmień zdjęcie */}
                  <label className={`mt-3 flex items-center justify-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition ${
                    isDark
                      ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}>
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">Zmień zdjęcie</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition ${
                    dragOver
                      ? "border-amber-500 bg-amber-500/10"
                      : isDark
                        ? "border-slate-600 hover:border-slate-500"
                        : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
                      <p className={t.textMuted}>Przesyłanie...</p>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className={`h-12 w-12 mx-auto mb-4 ${t.textMuted}`} />
                      <p className={`text-sm ${t.textMuted} mb-2`}>
                        Przeciągnij zdjęcie lub kliknij, aby wybrać
                      </p>
                      <p className={`text-xs ${t.textMuted}`}>PNG, JPG do 5MB</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </>
                  )}
                </div>
              )}
            </div>

            {/* URL ręczny */}
            <div>
              <label className={`text-xs font-medium mb-1.5 block ${t.textMuted}`}>
                Lub wklej URL zdjęcia
              </label>
              <input
                type="text"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                className={t.input}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        {form.name && (
          <div className={`mt-6 rounded-2xl ${t.bgCard} border ${t.border} p-6`}>
            <h3 className={`text-sm font-semibold mb-4 ${t.textMuted} uppercase tracking-wider`}>
              Podgląd na stronie
            </h3>
            <div className={`rounded-xl p-4 ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}>
              <div className="flex items-start gap-4">
                {form.image_url && (
                  <img
                    src={form.image_url}
                    alt={form.name}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className={`text-xs font-semibold uppercase text-orange-500`}>
                      Burger Miesiąca
                    </span>
                  </div>
                  <h4 className={`text-lg font-bold ${t.text}`}>{form.name}</h4>
                  <p className={`text-sm ${t.textMuted} whitespace-pre-line mt-2`}>
                    {form.description}
                  </p>
                  <p className={`text-lg font-bold text-amber-500 mt-3`}>{form.price} zł</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
