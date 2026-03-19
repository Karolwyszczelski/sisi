"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/components/admin/ThemeContext";
import {
  Link2, Loader2, CheckCircle2, XCircle, ExternalLink, Unplug,
  RefreshCw, Package, AlertCircle
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface IntegrationRecord {
  id: string;
  refresh_token: string;
  cloud_id: string;
  access_token?: string;
  access_token_expires_at?: string;
  connected_at?: string;
}

export default function IntegrationsForm() {
  const { isDark } = useTheme();
  const supabase = createClientComponentClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [cloudId, setCloudId] = useState<string>("");
  const [connectedAt, setConnectedAt] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; branches?: { id: number; name: string }[] } | null>(null);

  const [connecting, setConnecting] = useState(false);

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
      // Handle OAuth callback from new API (dotypos_success) or old (token)
      const dotyposSuccess = searchParams.get("dotypos_success");
      const dotyposError = searchParams.get("dotypos_error");
      const callbackCloudId = searchParams.get("cloudid");
      const token = searchParams.get("token");
      
      // Handle new callback format
      if (dotyposSuccess === "connected" && callbackCloudId) {
        setConnected(true);
        setCloudId(callbackCloudId);
        router.replace("/admin/settings");
        setLoading(false);
        return;
      }
      
      // Handle error
      if (dotyposError) {
        console.error("❌ Błąd połączenia Dotypos:", dotyposError);
        router.replace("/admin/settings");
        setLoading(false);
        return;
      }
      
      // Handle legacy callback (direct token in URL - for old admin.dotykacka.pl flow)
      if (token && callbackCloudId) {
        const { error } = await supabase
          .from("integrations")
          .upsert(
            { 
              id: "dotypos", 
              refresh_token: token, 
              cloud_id: callbackCloudId,
              connected_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );
        if (error) {
          console.error("❌ Błąd zapisu integracji Dotypos:", error.message);
        } else {
          setConnected(true);
          setCloudId(callbackCloudId);
        }
        router.replace("/admin/settings");
        setLoading(false);
        return;
      }

      // Check existing connection
      const { data, error } = await supabase
        .from("integrations")
        .select("refresh_token, cloud_id, connected_at")
        .eq("id", "dotypos")
        .single();
      if (!error && data?.refresh_token) {
        setConnected(true);
        setCloudId(data.cloud_id);
        if (data.connected_at) {
          setConnectedAt(new Date(data.connected_at).toLocaleDateString("pl-PL"));
        }
      }
      setLoading(false);
    })();
  }, [searchParams, supabase, router]);

  /**
   * Connect to Dotypos - redirects to auto-submitting POST form
   */
  const handleConnect = async () => {
    setConnecting(true);
    // Navigate directly to the connector-url endpoint
    // which returns an auto-submitting HTML form (POST to Dotypos)
    window.location.href = "/api/dotypos/connector-url";
  };

  const handleDisconnect = async () => {
    await supabase.from("integrations").delete().eq("id", "dotypos");
    setConnected(false);
    setCloudId("");
    setConnectedAt("");
    setConnectionStatus(null);
    setSyncResult(null);
  };
  
  /**
   * Test connection to Dotypos
   */
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    
    try {
      const res = await fetch("/api/dotypos/test-connection");
      const data = await res.json();
      
      if (data.connected) {
        setConnectionStatus({ ok: true, branches: data.branches });
      } else {
        setConnectionStatus({ ok: false });
      }
    } catch {
      setConnectionStatus({ ok: false });
    } finally {
      setTestingConnection(false);
    }
  };
  
  /**
   * Sync products from Dotypos
   */
  const handleSyncProducts = async () => {
    setSyncing(true);
    setSyncResult(null);
    
    try {
      const res = await fetch("/api/dotypos/sync-products");
      const data = await res.json();
      
      if (data.success) {
        setSyncResult({
          success: true,
          message: `Zsynchronizowano ${data.synced?.products || 0} produktów i ${data.synced?.categories || 0} kategorii`,
        });
      } else {
        setSyncResult({
          success: false,
          message: data.error || "Błąd synchronizacji",
        });
      }
    } catch (err) {
      setSyncResult({
        success: false,
        message: "Nie udało się połączyć z API",
      });
    } finally {
      setSyncing(false);
    }
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
              {/* Connection info */}
              <div className={`flex items-center gap-3 p-4 rounded-lg ${isDark ? "bg-slate-600/50" : "bg-gray-50"}`}>
                <div className={`p-2 rounded-lg ${isDark ? "bg-emerald-500/20" : "bg-emerald-100"}`}>
                  <CheckCircle2 className={`h-5 w-5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${t.text}`}>Połączono z chmurą</p>
                  <p className={`text-sm ${t.textMuted}`}>
                    Cloud ID: <span className="font-mono">{cloudId}</span>
                    {connectedAt && <span className="ml-2">• połączono {connectedAt}</span>}
                  </p>
                </div>
              </div>
              
              {/* Connection status */}
              {connectionStatus && (
                <div className={`flex items-center gap-3 p-4 rounded-lg ${
                  connectionStatus.ok 
                    ? isDark ? "bg-emerald-500/10" : "bg-emerald-50"
                    : isDark ? "bg-red-500/10" : "bg-red-50"
                }`}>
                  {connectionStatus.ok ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <div>
                        <p className={`font-medium ${t.text}`}>Połączenie działa</p>
                        {connectionStatus.branches && connectionStatus.branches.length > 0 && (
                          <p className={`text-sm ${t.textMuted}`}>
                            Oddziały: {connectionStatus.branches.map(b => b.name).join(", ")}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <p className={`font-medium ${t.text}`}>Błąd połączenia - sprawdź konfigurację</p>
                    </>
                  )}
                </div>
              )}
              
              {/* Sync result */}
              {syncResult && (
                <div className={`flex items-center gap-3 p-4 rounded-lg ${
                  syncResult.success 
                    ? isDark ? "bg-emerald-500/10" : "bg-emerald-50"
                    : isDark ? "bg-red-500/10" : "bg-red-50"
                }`}>
                  {syncResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <p className={`font-medium ${t.text}`}>{syncResult.message}</p>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition ${
                    isDark 
                      ? "bg-slate-600 hover:bg-slate-500 text-white" 
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  } disabled:opacity-50`}
                >
                  {testingConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Test połączenia
                </button>
                
                <button
                  onClick={handleSyncProducts}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition disabled:opacity-50"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                  Synchronizuj produkty
                </button>
                
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition"
                >
                  <Unplug className="h-4 w-4" />
                  Rozłącz
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className={`text-sm ${t.textMuted}`}>
                Połącz z Dotypos aby automatycznie synchronizować zamówienia z systemem kasowym.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {connecting ? "Łączenie..." : "Połącz z Dotypos"}
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
