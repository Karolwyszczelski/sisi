"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/components/admin/ThemeContext";
import {
  Link2, Loader2, CheckCircle2, XCircle, ExternalLink, Unplug
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface IntegrationRecord {
  id: string;
  refresh_token: string;
  cloud_id: string;
}

export default function IntegrationsForm() {
  const { isDark } = useTheme();
  const supabase = createClientComponentClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [cloudId, setCloudId] = useState<string>("");

  // Theme classes
  const t = {
    bg: isDark ? "bg-slate-700/30" : "bg-gray-50",
    bgCard: isDark ? "bg-slate-700/50" : "bg-white",
    border: isDark ? "border-slate-600" : "border-gray-200",
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-slate-400" : "text-gray-500",
  };

  useEffect(() => {
    (async () => {
      const token = searchParams.get("token");
      const cloudid = searchParams.get("cloudid");
      if (token && cloudid) {
        const { error } = await supabase
          .from("integrations")
          .upsert(
            { id: "dotypos", refresh_token: token, cloud_id: cloudid },
            { onConflict: "id" }
          );
        if (error) {
          console.error("❌ Błąd zapisu integracji Dotypos:", error.message);
        } else {
          setConnected(true);
          setCloudId(cloudid);
        }
        router.replace("/admin/settings");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("integrations")
        .select("refresh_token, cloud_id")
        .eq("id", "dotypos")
        .single();
      if (!error && data?.refresh_token) {
        setConnected(true);
        setCloudId(data.cloud_id);
      }
      setLoading(false);
    })();
  }, [searchParams, supabase, router]);

  const connectorUrl = () => {
    const clientId = process.env.NEXT_PUBLIC_DOTYPOS_CLIENT_ID;
    const clientSecret = process.env.NEXT_PUBLIC_DOTYPOS_CLIENT_SECRET;
    const redirectUri = `${window.location.origin}/admin/settings`;
    const state = Math.random().toString(36).slice(2);

    return (
      `https://admin.dotykacka.pl/client/connect` +
      `?client_id=${encodeURIComponent(clientId!)}` +
      `&client_secret=${encodeURIComponent(clientSecret!)}` +
      `&scope=*` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`
    );
  };

  const handleDisconnect = async () => {
    await supabase.from("integrations").delete().eq("id", "dotypos");
    setConnected(false);
    setCloudId("");
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 rounded-xl ${t.bg}`}>
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${isDark ? "bg-purple-500/20" : "bg-purple-100"}`}>
          <Link2 className={`h-5 w-5 ${isDark ? "text-purple-400" : "text-purple-600"}`} />
        </div>
        <div>
          <h3 className={`text-lg font-semibold ${t.text}`}>Integracje</h3>
          <p className={`text-sm ${t.textMuted}`}>Połącz z zewnętrznymi systemami</p>
        </div>
      </div>

      {/* Dotypos Card */}
      <div className={`rounded-xl border ${t.border} ${t.bgCard} overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
              isDark ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-100 text-indigo-600"
            }`}>
              D
            </div>
            <div>
              <h4 className={`font-semibold ${t.text}`}>Dotypos / Dotykačka</h4>
              <p className={`text-sm ${t.textMuted}`}>System POS dla restauracji</p>
            </div>
          </div>
          {connected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Połączono</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">Niepołączone</span>
            </div>
          )}
        </div>

        <div className="p-5">
          {connected ? (
            <div className="space-y-4">
              <div className={`flex items-center gap-3 p-4 rounded-lg ${isDark ? "bg-slate-600/50" : "bg-gray-50"}`}>
                <div className={`p-2 rounded-lg ${isDark ? "bg-emerald-500/20" : "bg-emerald-100"}`}>
                  <CheckCircle2 className={`h-5 w-5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                </div>
                <div>
                  <p className={`font-medium ${t.text}`}>Połączono z chmurą</p>
                  <p className={`text-sm ${t.textMuted}`}>Cloud ID: <span className="font-mono">{cloudId}</span></p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition"
              >
                <Unplug className="h-4 w-4" />
                Rozłącz integrację
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className={`text-sm ${t.textMuted}`}>
                Połącz z Dotypos aby automatycznie synchronizować zamówienia z systemem kasowym.
              </p>
              <button
                onClick={() => (window.location.href = connectorUrl())}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition"
              >
                <ExternalLink className="h-4 w-4" />
                Połącz z Dotypos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Placeholder for more integrations */}
      <div className={`rounded-xl border-2 border-dashed ${t.border} p-8 text-center`}>
        <Link2 className={`h-10 w-10 mx-auto mb-3 ${t.textMuted}`} />
        <p className={`font-medium ${t.text}`}>Więcej integracji wkrótce</p>
        <p className={`text-sm ${t.textMuted}`}>Pracujemy nad nowymi połączeniami</p>
      </div>
    </div>
  );
}
