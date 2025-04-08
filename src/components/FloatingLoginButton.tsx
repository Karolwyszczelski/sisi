"use client";

import React, { useState, useEffect, memo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { ShoppingCart, User, X, MapPin, ShoppingBag, Truck } from "lucide-react";
import useCartStore from "../store/cartStore";
import { useRouter } from "next/navigation";
import { useSession } from "@supabase/auth-helpers-react";
import QRCode from "react-qr-code";
import Script from "next/script";
import AddressAutocomplete from "@/components/menu/AddressAutocomplete";

// Inicjalizacja klienta Supabase
const supabase = createClientComponentClient();

// RegistrationModal – wyodrębniony i opakowany w React.memo, aby nie tracił focusu
const RegistrationModal = memo(({
  onClose,
  handleSubmitRegister,
  fullName,
  setFullName,
  phone,
  setPhone,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  captchaChecked,
  setCaptchaChecked,
  acceptTerms,
  setAcceptTerms,
}: {
  onClose: () => void;
  handleSubmitRegister: (e: React.FormEvent) => Promise<void>;
  fullName: string;
  setFullName: React.Dispatch<React.SetStateAction<string>>;
  phone: string;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  confirmPassword: string;
  setConfirmPassword: React.Dispatch<React.SetStateAction<string>>;
  captchaChecked: boolean;
  setCaptchaChecked: React.Dispatch<React.SetStateAction<boolean>>;
  acceptTerms: boolean;
  setAcceptTerms: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full relative max-h-[80vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-black">
          <X size={20} />
        </button>
        <h2 className="text-xl font-bold mb-4 text-center">Utwórz konto</h2>
        <form onSubmit={handleSubmitRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Imię i nazwisko"
            className="w-full border rounded-lg px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <input
            type="tel"
            placeholder="Telefon (9 cyfr)"
            pattern="^\d{9}$"
            className="w-full border rounded-lg px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            className="w-full border rounded-lg px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Hasło"
            className="w-full border rounded-lg px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Powtórz hasło"
            className="w-full border rounded-lg px-3 py-2"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={captchaChecked}
              onChange={(e) => setCaptchaChecked(e.target.checked)}
              required
              className="mr-2"
            />
            <span className="text-sm">Nie jestem robotem</span>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              required
              className="mr-2"
            />
            <span className="text-sm">Akceptuję regulamin</span>
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600"
          >
            Zarejestruj się
          </button>
        </form>
      </div>
    </div>
  );
});
RegistrationModal.displayName = "RegistrationModal";

export default function FloatingAuthButtons() {
  const router = useRouter();
  const session = useSession();
  const isLoggedIn = !!session?.user;

  const toggleCart = useCartStore((state) => state.toggleCart);
  const items = useCartStore((state) => state.items);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Kontrola modala: "small" (mały popup) lub "large" (duży popup)
  const [modalType, setModalType] = useState<"small" | "large">("small");
  const [showModal, setShowModal] = useState(false);

  // Stany logowania/rejestracji
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert("Błąd logowania: " + error.message);
      return;
    }
    alert("Zalogowano pomyślnie!");
    router.refresh();
    setShowModal(false);
  };

  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Hasła muszą być identyczne.");
      return;
    }
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      alert("Hasło musi mieć co najmniej 8 znaków, zawierać jedną dużą literę oraz znak specjalny.");
      return;
    }
    if (!captchaChecked) {
      alert("Potwierdź, że nie jesteś robotem.");
      return;
    }
    if (!acceptTerms) {
      alert("Musisz zaakceptować regulamin.");
      return;
    }
    if (!/^\d{9}$/.test(phone)) {
      alert("Podaj prawidłowy numer telefonu (9 cyfr).");
      return;
    }
    // Przekazujemy dane do user_metadata (full_name oraz phone)
    const { error, data } = await supabase.auth.signUp(
      { email, password },
      {
        emailRedirectTo: "http://localhost:3000/verify",
        data: { role: "client", full_name: fullName, phone: phone }
      }
    );
    if (error) {
      alert("Błąd rejestracji: " + error.message);
      return;
    }
    // Wywołanie updateUser, aby upewnić się, że user_metadata zostanie odświeżone
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: fullName, phone: phone }
    });
    if (updateError) {
      console.error("Błąd aktualizacji użytkownika: ", updateError.message);
    }
    alert("Konto zostało utworzone. Sprawdź skrzynkę pocztową i potwierdź email, a następnie zaloguj się.");
    setShowModal(false);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("Wylogowanie nie powiodło się: " + error.message);
    } else {
      alert("Wylogowano pomyślnie!");
      router.refresh();
      setShowModal(false);
    }
  };

  // Mały modal dla niezalogowanych (logowanie)
  const SmallAuthModal = ({ onClose }: { onClose: () => void }) => (
    <div className="fixed bottom-20 right-6 z-50 w-72 bg-white border border-gray-200 shadow-lg p-4 rounded-lg">
      <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-black">
        <X size={18} />
      </button>
      <h2 className="text-lg font-bold mb-3 text-center">Zaloguj się</h2>
      <form onSubmit={handleSubmitLogin} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          className="w-full border rounded-lg px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Hasło"
          className="w-full border rounded-lg px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="w-full py-2 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600">
          Zaloguj się
        </button>
      </form>
      <div className="mt-3 text-center text-sm">
        Nie masz konta?{" "}
        <button onClick={() => setModalType("large")} className="text-blue-500 underline">
          Zarejestruj się
        </button>
      </div>
    </div>
  );

  // Mały modal dla zalogowanych – krótki panel
  const SmallClientModal = ({ onClose }: { onClose: () => void }) => {
    const username = session?.user?.user_metadata?.full_name || session?.user?.email || "Kliencie";
    const goToOrders = () => {
      setModalType("large");
      localStorage.setItem("panelDefaultTab", "orders");
    };
    return (
      <div className="fixed bottom-20 right-6 z-50 w-72 bg-white border border-gray-200 shadow-lg p-4 rounded-lg">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-black">
          <X size={18} />
        </button>
        <p className="text-center mb-3 font-semibold">Hej {username}!</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              setShowModal(false);
              router.push("/#menu");
            }}
            className="w-full py-2 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600"
          >
            Nowe zamówienie
          </button>
          <button
            onClick={goToOrders}
            className="w-full py-2 border border-black text-black rounded-lg hover:bg-black hover:text-white transition"
          >
            Historia zamówień
          </button>
          <button
            onClick={() => setModalType("large")}
            className="w-full py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Panel Klienta
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition"
          >
            Wyloguj się
          </button>
        </div>
      </div>
    );
  };

  // Duży modal – panel klienta z zakładkami
  const ClientPanelWithTabs = ({ onClose }: { onClose: () => void }) => {
    const [selectedTab, setSelectedTab] = useState("orders");
    const username = session?.user?.user_metadata?.full_name || session?.user?.email || "Kliencie";
    useEffect(() => {
      const defaultTab = localStorage.getItem("panelDefaultTab");
      if (defaultTab) {
        setSelectedTab(defaultTab);
        localStorage.removeItem("panelDefaultTab");
      }
    }, []);
    const userSpent = 150;
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
    const [localFullName, setLocalFullName] = useState(session?.user?.user_metadata?.full_name || "");
    const [localPhone, setLocalPhone] = useState(session?.user?.user_metadata?.phone || "");
    const [localEmail, setLocalEmail] = useState(session?.user?.email || "");
    const [localAddress, setLocalAddress] = useState(session?.user?.user_metadata?.address || "");
    const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword || newPasswordConfirm) {
        if (newPassword !== newPasswordConfirm) {
          alert("Nowe hasła nie są identyczne!");
          return;
        }
      }
      alert("Dane zostały zapisane! (Tutaj dodać logikę aktualizacji)");
    };
    const content = (() => {
      switch (selectedTab) {
        case "orders":
          return (
            <div className="flex flex-col gap-4">
              <p className="text-center">
                Zobacz co ostatnio zamawiałeś, może ponownie stworzymy to samo? ;)
              </p>
              <div className="border p-4 rounded-lg">
                <p>Brak zamówień do wyświetlenia.</p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  router.push("/#menu");
                }}
                className="py-2 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600"
              >
                Skomponuj nowe zamówienie
              </button>
            </div>
          );
        case "loyalty":
          return (
            <div className="flex flex-col gap-4">
              <p className="text-center">Tu znajdziesz swoje rabaty i inne nagrody</p>
              <div>
                <p className="mb-2 font-semibold">Program lojalnościowy – Naklejki:</p>
                <div className="flex gap-2 flex-wrap">
                  {[...Array(10)].map((_, i) => {
                    const isUnlocked = i < Math.floor(userSpent / 50);
                    return (
                      <div
                        key={i}
                        className={`w-12 h-12 rounded-full border-2 border-black flex items-center justify-center text-sm font-semibold ${
                          isUnlocked ? "bg-yellow-100 text-black" : "bg-gray-100 text-gray-300"
                        }`}
                      >
                        {isUnlocked ? "50 zł" : ""}
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm mt-2">
                  Każde wydane 50 zł odblokowuje jedną naklejkę. Po wydaniu 500 zł otrzymasz kod rabatowy na 50 zł.
                </p>
              </div>
              <div>
                <p className="mb-2 font-semibold">Masz już kod rabatowy?</p>
                <input type="text" placeholder="Wpisz kod rabatowy" className="w-full border rounded-lg px-3 py-2" />
                <button className="mt-2 py-2 bg-black text-white rounded-lg hover:bg-gray-800 w-full">
                  Zastosuj kod
                </button>
              </div>
            </div>
          );
        case "settings":
          return (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <p className="text-sm font-medium">Zmień swoje dane osobowe lub hasło</p>
              <input
                type="text"
                placeholder="Imię i nazwisko"
                value={localFullName}
                onChange={(e) => setLocalFullName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
              <input
                type="tel"
                placeholder="Numer telefonu"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
              <input
                type="email"
                placeholder="Adres e-mail"
                value={localEmail}
                onChange={(e) => setLocalEmail(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
              <input
                type="text"
                placeholder="Adres"
                value={localAddress}
                onChange={(e) => setLocalAddress(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
              <p className="text-sm font-semibold mt-2">Zmiana hasła:</p>
              <input
                type="password"
                placeholder="Stare hasło"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
              <input
                type="password"
                placeholder="Nowe hasło"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
              <input
                type="password"
                placeholder="Powtórz nowe hasło"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
              <button type="submit" className="w-full py-2 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600">
                Zapisz zmiany
              </button>
            </form>
          );
        default:
          return null;
      }
    })();

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white p-4 rounded-lg max-w-lg w-full relative max-h-[80vh] overflow-y-auto">
          <button onClick={() => onClose()} className="absolute top-3 right-3 text-gray-500 hover:text-black">
            <X size={20} />
          </button>
          <div className="flex flex-col border-b pb-2 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Panel Klienta</h2>
              <button
                onClick={async () => {
                  await handleLogout();
                }}
                className="px-3 py-1 border border-red-500 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition"
              >
                Wyloguj się
              </button>
            </div>
            <p className="text-center mt-2">Hej {username}. Miło Cię widzieć ponownie!</p>
          </div>
          <div className="flex justify-between mb-4">
            <button className={`px-4 py-2 font-semibold ${selectedTab === "orders" ? "border-b-2 border-black" : ""}`} onClick={() => setSelectedTab("orders")}>
              Historia zamówień
            </button>
            <button className={`px-4 py-2 font-semibold ${selectedTab === "loyalty" ? "border-b-2 border-black" : ""}`} onClick={() => setSelectedTab("loyalty")}>
              Program lojalnościowy
            </button>
            <button className={`px-4 py-2 font-semibold ${selectedTab === "settings" ? "border-b-2 border-black" : ""}`} onClick={() => setSelectedTab("settings")}>
              Ustawienia
            </button>
          </div>
          <div className="mb-4">{content}</div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Opakowanie przycisków na stałe położonych w prawym dolnym rogu */}
      <div className="pointer-events-auto fixed bottom-6 right-6 z-50">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              setModalType("small");
              setShowModal(true);
            }}
            title="Panel klienta / Logowanie"
            className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-105 transition"
          >
            <User className="text-black w-5 h-5" />
          </button>
          <button
            onClick={() => toggleCart()}
            aria-label="Koszyk"
            className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-105 transition relative"
          >
            <ShoppingCart className="text-black w-6 h-6" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
      {showModal &&
        (modalType === "small" ? (
          session?.user ? (
            <SmallClientModal onClose={() => setShowModal(false)} />
          ) : (
            <SmallAuthModal onClose={() => setShowModal(false)} />
          )
        ) : session?.user ? (
          <ClientPanelWithTabs onClose={() => setShowModal(false)} />
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
            captchaChecked={captchaChecked}
            setCaptchaChecked={setCaptchaChecked}
            acceptTerms={acceptTerms}
            setAcceptTerms={setAcceptTerms}
          />
        ))}
    </>
  );
}
