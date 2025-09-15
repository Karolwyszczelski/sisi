// src/app/components/FloatingAuthButtons.tsx
"use client";

import React, { useState, useEffect, memo, useCallback, useMemo, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSession, Session } from "@supabase/auth-helpers-react";
import { ShoppingCart, User, X } from "lucide-react";
import useCartStore from "../store/cartStore";
import { useRouter } from "next/navigation";
import AddressAutocomplete from "@/components/menu/AddressAutocomplete";

declare global {
  interface Window {
    turnstile?: any;
  }
}

const TERMS_URL =
  process.env.NEXT_PUBLIC_TERMS_URL || "https://www.sisiciechanow.pl/regulamin";
const PRIVACY_URL =
  process.env.NEXT_PUBLIC_PRIVACY_URL || "https://www.sisiciechanow.pl/polityka-prywatnosci";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

/* ------------------- utils ------------------- */
function normalizePlPhone(input: string): string | null {
  const d = String(input).replace(/\D/g, "");
  if (d.length === 9) return "+48" + d;
  if (d.startsWith("48") && d.length === 11) return "+" + d;
  if (d.startsWith("0048") && d.length === 13) return "+" + d.slice(2);
  if (/^\+48\d{9}$/.test("+" + d)) return "+48" + d.slice(-9);
  if (/^\+\d{9,15}$/.test(input)) return input;
  return null;
}

/* ------------------- Turnstile ------------------- */
const TurnstileBox: React.FC<{ onVerify: (token: string) => void }> = ({ onVerify }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let rendered = false;

    function render() {
      if (rendered || !ref.current || !window.turnstile || !TURNSTILE_SITE_KEY) return;
      rendered = true;
      window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light",
        appearance: "always",
        callback: (token: string) => onVerify(token),
        "error-callback": () => onVerify(""),
        "timeout-callback": () => onVerify(""),
        "unsupported-callback": () => onVerify(""),
      });
    }

    // doładowanie skryptu jeśli nie ma
    if (!window.turnstile) {
      const id = "cf-turnstile-api";
      if (!document.getElementById(id)) {
        const s = document.createElement("script");
        s.id = id;
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.defer = true;
        s.onload = render;
        document.head.appendChild(s);
      } else {
        // może już się ładuje – spróbuj wyrenderować po chwili
        const t = setInterval(() => {
          if (window.turnstile) {
            clearInterval(t);
            render();
          }
        }, 200);
        return () => clearInterval(t);
      }
    } else {
      render();
    }
  }, [onVerify]);

  return <div ref={ref} className="cf-turnstile" />;
};

/* ------------------- Modale ------------------- */

const RegistrationModal = memo(({
  onClose,
  handleSubmitRegister,
  fullName, setFullName,
  phone, setPhone,
  email, setEmail,
  password, setPassword,
  confirmPassword, setConfirmPassword,
  captchaToken, setCaptchaToken,
  acceptTerms, setAcceptTerms,
}: {
  onClose: () => void;
  handleSubmitRegister: (e: React.FormEvent) => Promise<void>;
  fullName: string; setFullName: React.Dispatch<React.SetStateAction<string>>;
  phone: string; setPhone: React.Dispatch<React.SetStateAction<string>>;
  email: string; setEmail: React.Dispatch<React.SetStateAction<string>>;
  password: string; setPassword: React.Dispatch<React.SetStateAction<string>>;
  confirmPassword: string; setConfirmPassword: React.Dispatch<React.SetStateAction<string>>;
  captchaToken: string; setCaptchaToken: React.Dispatch<React.SetStateAction<string>>;
  acceptTerms: boolean; setAcceptTerms: React.Dispatch<React.SetStateAction<boolean>>;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-white p-6 rounded-lg max-w-md w-full relative max-h-[80vh] overflow-y-auto">
      <button aria-label="Zamknij" onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-black">
        <X size={20} />
      </button>
      <h2 className="text-xl font-bold mb-4 text-center">Utwórz konto</h2>
      <form onSubmit={handleSubmitRegister} className="space-y-4">
        <input
          type="text"
          placeholder="Imię i nazwisko"
          className="w-full border rounded-lg px-3 py-2"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          required
        />
        <input
          type="tel"
          inputMode="tel"
          placeholder="Telefon (+48… lub 9 cyfr)"
          className="w-full border rounded-lg px-3 py-2"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          className="w-full border rounded-lg px-3 py-2"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Hasło"
          className="w-full border rounded-lg px-3 py-2"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Powtórz hasło"
          className="w-full border rounded-lg px-3 py-2"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
        />

        {/* Turnstile */}
        {TURNSTILE_SITE_KEY ? (
          <div>
            <TurnstileBox onVerify={setCaptchaToken} />
            {!captchaToken && (
              <p className="mt-1 text-xs text-gray-500">
                Zaznacz proszę weryfikację, aby kontynuować.
              </p>
            )}
          </div>
        ) : (
          <div className="text-xs text-amber-600">
            Uwaga: brak klucza <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>.
          </div>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={e => setAcceptTerms(e.target.checked)}
            required
            className="mt-1"
          />
          <span>
            Akceptuję{" "}
            <a href={TERMS_URL} target="_blank" className="text-blue-600 underline">regulamin</a>{" "}
            oraz{" "}
            <a href={PRIVACY_URL} target="_blank" className="text-blue-600 underline">politykę prywatności</a>.
          </span>
        </label>

        <button
          type="submit"
          className="w-full py-2 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600"
        >
          Zarejestruj się
        </button>
      </form>
    </div>
  </div>
));
RegistrationModal.displayName = "RegistrationModal";

const SmallAuthModal: React.FC<{
  onClose: () => void;
  handleSubmitLogin: (e: React.FormEvent) => Promise<void>;
  email: string; setEmail: React.Dispatch<React.SetStateAction<string>>;
  password: string; setPassword: React.Dispatch<React.SetStateAction<string>>;
  onSwitchToLarge: () => void;
}> = ({ onClose, handleSubmitLogin, email, setEmail, password, setPassword, onSwitchToLarge }) => (
  <div className="fixed bottom-20 right-6 z-50 w-72 bg-white border shadow-lg p-4 rounded-lg">
    <button aria-label="Zamknij" onClick={onClose} className="absolute top-2 right-2 text-gray-500">
      <X size={18} />
    </button>
    <h2 className="text-lg font-bold mb-3 text-center">Zaloguj się</h2>
    <form onSubmit={handleSubmitLogin} className="space-y-3">
      <input
        type="email"
        placeholder="Email"
        className="w-full border rounded px-3 py-2"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Hasło"
        className="w-full border rounded px-3 py-2"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button type="submit" className="w-full py-2 bg-yellow-500 text-white rounded-lg">
        Zaloguj się
      </button>
    </form>
    <p className="mt-3 text-center text-sm">
      Nie masz konta?{" "}
      <button onClick={onSwitchToLarge} className="text-blue-500 underline">
        Zarejestruj się
      </button>
    </p>
  </div>
);

const SmallClientModal: React.FC<{
  onClose: () => void;
  session: Session | null;
  onSwitchToLarge: () => void;
  onLogout: () => void;
}> = ({ onClose, session, onSwitchToLarge, onLogout }) => {
  const router = useRouter();
  const name =
    (session?.user?.user_metadata as any)?.full_name ||
    session?.user?.email ||
    "Klient";
  return (
    <div className="fixed bottom-20 right-6 z-50 w-72 bg-white border shadow-lg p-4 rounded-lg">
      <button aria-label="Zamknij" onClick={onClose} className="absolute top-2 right-2 text-gray-500">
        <X size={18} />
      </button>
      <p className="text-center mb-3 font-semibold">Hej {name}!</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            router.push("/#menu");
            onClose();
          }}
          className="w-full py-2 bg-yellow-500 text-white rounded-lg"
        >
          Nowe zamówienie
        </button>
        <button
          type="button"
          onClick={onSwitchToLarge}
          className="w-full py-2 border border-black rounded-lg"
        >
          Historia zamówień
        </button>
        <button
          type="button"
          onClick={onSwitchToLarge}
          className="w-full py-2 bg-black text-white rounded-lg"
        >
          Panel Klienta
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-2 border border-red-500 text-red-500 rounded-lg"
        >
          Wyloguj się
        </button>
      </div>
    </div>
  );
};

const OrdersHistory: React.FC<{ supabaseClient: ReturnType<typeof createClientComponentClient>; onRepeat: (o: any) => void }> = ({ supabaseClient, onRepeat }) => {
  const session = useSession();
  const userId = session?.user?.id;
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabaseClient
      .from("orders")
      .select("id, created_at, status, total_price, selected_option, items")
      .eq("user_id", userId) // <— poprawione
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data, error }) => {
        if (!error && data) setOrders(data);
      })
      .finally(() => setLoading(false));
  }, [userId, supabaseClient]);

  if (!userId) return <p className="text-center">Zaloguj się, aby zobaczyć historię.</p>;
  if (loading) return <p className="text-center">Ładowanie…</p>;
  if (!orders.length) return <p className="text-center">Brak zamówień.</p>;

  const label = (s?: string) =>
    s === "placed" ? "Złożone"
    : s === "preparing" ? "W przygotowaniu"
    : s === "ready" ? "Gotowe do odbioru"
    : s === "delivered" ? "Dostarczone"
    : s === "completed" ? "Zakończone"
    : s === "cancelled" ? "Anulowane"
    : (s ?? "—");

  return (
    <div className="space-y-3">
      {orders.map(o => (
        <div key={o.id} className="border p-3 rounded-lg flex justify-between items-center">
          <div>
            <p className="font-semibold">#{o.id} • {label(o.status)}</p>
            <p className="text-sm text-gray-600">
              {new Date(o.created_at).toLocaleString()} • {o.selected_option === "delivery" ? "Dostawa" : o.selected_option === "takeaway" ? "Na wynos" : "Na miejscu"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{Number(o.total_price ?? 0).toFixed(2)} zł</span>
            <button
              type="button"
              onClick={() => onRepeat(o)}
              className="py-1 px-3 bg-black text-white rounded hover:bg-gray-800"
            >
              Zamów ponownie
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const LoyaltyProgram: React.FC<{ supabaseClient: ReturnType<typeof createClientComponentClient> }> = ({ supabaseClient }) => {
  const session = useSession();
  const userId = session?.user?.id;
  const [stamps, setStamps] = useState(0);
  const goal = 10;

  useEffect(() => {
    if (!userId) return;
    supabaseClient
      .from("loyalty")
      .select("stamps")
      .eq("user_id", userId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setStamps(data.stamps || 0);
      });
  }, [userId, supabaseClient]);

  return (
    <div className="space-y-4 text-center">
      <p>
        Zdobyłeś <strong>{stamps}</strong> naklejek — do nagrody:{" "}
        <strong>{Math.max(goal - stamps, 0)}</strong>
      </p>
      <div className="flex justify-center space-x-2">
        {[...Array(goal)].map((_, i) => (
          <div
            key={i}
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
              i < stamps ? "bg-yellow-400 border-yellow-600" : "bg-gray-200 border-gray-400"
            }`}
          >
            {i < stamps ? "✔️" : i + 1}
          </div>
        ))}
      </div>
      <div className="h-2 bg-gray-300 rounded overflow-hidden mx-auto max-w-sm">
        <div
          className="h-full bg-yellow-500"
          style={{ width: `${Math.min((stamps / goal) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
};

/* ------------------- Main ------------------- */

export default function FloatingAuthButtons() {
  const router = useRouter();
  const session = useSession();
  const supabase = createClientComponentClient();
  const isLoggedIn = !!session?.user;

  const toggleCart = useCartStore(s => s.toggleCart);
  const items = useCartStore(s => s.items);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const [modalType, setModalType] = useState<"small" | "large">("small");
  const [showModal, setShowModal] = useState(false);

  // logowanie
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmitLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return alert("Błąd logowania: " + error.message);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("Brak użytkownika");
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) console.warn("Błąd pobierania profilu:", profileErr);
      const role = (profile as any)?.role;
      if (role === "admin" || role === "employee") {
        alert("Jesteś pracownikiem → Panel Admina");
        router.push("/admin");
        return;
      }
      alert("Zalogowano pomyślnie!");
      setShowModal(false);
      router.refresh();
    },
    [email, password, supabase, router]
  );

  // rejestracja
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleSubmitRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!acceptTerms) return alert("Musisz zaakceptować regulamin i politykę prywatności.");
      if (!captchaToken && TURNSTILE_SITE_KEY) return alert("Potwierdź proszę captcha.");
      if (password !== confirmPassword) return alert("Hasła muszą być identyczne.");

      const normalizedPhone = normalizePlPhone(phone);
      if (!normalizedPhone) return alert("Podaj prawidłowy polski numer telefonu (9 cyfr lub +48…).");

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify`,
          data: {
            role: "client",
            full_name: fullName,
            phone: normalizedPhone,
            legal_accept: {
              terms: true,
              privacy: true,
              at: new Date().toISOString(),
            },
          },
        },
      });

      if (signUpError) return alert("Błąd: " + signUpError.message);

      alert("Zarejestrowano! Sprawdź skrzynkę i potwierdź adres e-mail.");
      setShowModal(false);
    },
    [acceptTerms, captchaToken, email, password, confirmPassword, fullName, phone, supabase]
  );

  const handleLogout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) alert("Błąd wylogowania: " + error.message);
    else {
      alert("Wylogowano");
      router.refresh();
      setShowModal(false);
    }
  }, [supabase, router]);

  const repeatOrder = useCallback(
    (o: any) => {
      try {
        const items = typeof o.items === "string" ? JSON.parse(o.items) : (o.items || []);
        localStorage.setItem("reorder_items", JSON.stringify(items));
      } catch {}
      router.push("/#menu");
    },
    [router]
  );

  return (
    <>
      {/* przyciski */}
      <div className="fixed bottom-6 right-6 z-50 flex space-x-4 pointer-events-auto">
        <button
          type="button"
          aria-label="Użytkownik"
          onClick={() => {
            setModalType("small");
            setShowModal(true);
          }}
          className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center hover:scale-105 transition"
        >
          <User className="text-black w-5 h-5" />
        </button>
        <button
          type="button"
          aria-label="Koszyk"
          onClick={() => toggleCart()}
          className="w-14 h-14 rounded-full bg-white shadow flex items-center justify-center hover:scale-105 transition relative"
        >
          <ShoppingCart className="text-black w-6 h-6" />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </button>
      </div>

      {showModal && (
        <>
          {modalType === "small" ? (
            isLoggedIn ? (
              <SmallClientModal
                onClose={() => setShowModal(false)}
                session={session}
                onSwitchToLarge={() => setModalType("large")}
                onLogout={handleLogout}
              />
            ) : (
              <SmallAuthModal
                onClose={() => setShowModal(false)}
                handleSubmitLogin={handleSubmitLogin}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                onSwitchToLarge={() => setModalType("large")}
              />
            )
          ) : isLoggedIn ? (
            <ClientPanelWithTabsWrapper
              onClose={() => setShowModal(false)}
              supabaseClient={supabase}
              repeatOrder={repeatOrder}
            />
          ) : (
            <RegistrationModal
              onClose={() => setShowModal(false)}
              handleSubmitRegister={handleSubmitRegister}
              fullName={fullName}
              setFullName={setFullName}
              phone={phone}
              setPhone={setPhone}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              captchaToken={captchaToken}
              setCaptchaToken={setCaptchaToken}
              acceptTerms={acceptTerms}
              setAcceptTerms={setAcceptTerms}
            />
          )}
        </>
      )}
    </>
  );
}

/* -------- Panel klienta (tabs) -------- */

const ClientPanelWithTabsWrapper: React.FC<{
  onClose: () => void;
  supabaseClient: ReturnType<typeof createClientComponentClient>;
  repeatOrder: (o: any) => void;
}> = ({ onClose, supabaseClient, repeatOrder }) => {
  const session = useSession();
  const [tab, setTab] = useState<"orders" | "loyalty" | "settings">("orders");

  const [localName, setLocalName] = useState<string>(
    ((session?.user?.user_metadata as any)?.full_name as string) || ""
  );
  const [localPhone, setLocalPhone] = useState<string>(
    ((session?.user?.user_metadata as any)?.phone as string) || ""
  );
  const [localEmail, setLocalEmail] = useState<string>(session?.user?.email || "");
  const [localAddress, setLocalAddress] = useState<string>(
    ((session?.user?.user_metadata as any)?.address as string) || ""
  );
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    // walidacja i normalizacja telefonu
    const norm = normalizePlPhone(localPhone);
    if (!norm) return alert("Podaj prawidłowy numer telefonu (+48…).");

    if (newPass || newPass2) {
      if (newPass !== newPass2) return alert("Nowe hasła nie pasują!");
      const { error: reauthErr } = await supabaseClient.auth.signInWithPassword({
        email: localEmail,
        password: oldPass,
      });
      if (reauthErr) return alert("Stare hasło nieprawidłowe!");
      const { error: updErr } = await supabaseClient.auth.updateUser({ password: newPass });
      if (updErr) return alert("Błąd zmiany hasła: " + updErr.message);
    }

    const { error: updMeta } = await supabaseClient.auth.updateUser({
      data: { full_name: localName, phone: norm, address: localAddress },
    });
    if (updMeta) return alert("Błąd zapisu profilu: " + updMeta.message);

    alert("Ustawienia zapisane!");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white p-4 rounded-lg max-w-lg w-full relative max-h-[80vh] overflow-y-auto">
        <button aria-label="Zamknij" onClick={onClose} className="absolute top-3 right-3 text-gray-500">
          <X size={20} />
        </button>
        <div className="flex justify-between mb-4">
          {["orders", "loyalty", "settings"].map(t => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`px-4 py-2 font-semibold ${tab === t ? "border-b-2 border-black" : ""}`}
            >
              {t === "orders"
                ? "Historia zamówień"
                : t === "loyalty"
                ? "Program lojalnościowy"
                : "Ustawienia"}
            </button>
          ))}
        </div>
        <div className="mb-4">
          {tab === "orders" && <OrdersHistory supabaseClient={supabaseClient} onRepeat={repeatOrder} />}
          {tab === "loyalty" && <LoyaltyProgram supabaseClient={supabaseClient} />}
          {tab === "settings" && (
            <form className="space-y-4" onSubmit={handleSaveSettings}>
              <input
                type="text"
                placeholder="Imię i nazwisko"
                className="w-full border rounded px-3 py-2"
                value={localName}
                onChange={e => setLocalName(e.target.value)}
                required
              />
              <input
                type="tel"
                placeholder="Telefon (+48…)"
                className="w-full border rounded px-3 py-2"
                value={localPhone}
                onChange={e => setLocalPhone(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full border rounded px-3 py-2"
                value={localEmail}
                onChange={e => setLocalEmail(e.target.value)}
                required
              />
              <AddressAutocomplete value={localAddress} onSelect={setLocalAddress} />
              <hr />
              <input
                type="password"
                placeholder="Stare hasło"
                className="w-full border rounded px-3 py-2"
                value={oldPass}
                onChange={e => setOldPass(e.target.value)}
              />
              <input
                type="password"
                placeholder="Nowe hasło"
                className="w-full border rounded px-3 py-2"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
              />
              <input
                type="password"
                placeholder="Powtórz nowe hasło"
                className="w-full border rounded px-3 py-2"
                value={newPass2}
                onChange={e => setNewPass2(e.target.value)}
              />
              <button type="submit" className="w-full py-2 bg-yellow-500 text-white rounded-lg">
                Zapisz zmiany
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
