// src/components/CheckoutModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { X, MapPin, ShoppingBag, Truck } from "lucide-react";
import useIsClient from "@/lib/useIsClient";
import useCartStore from "@/store/cartStore";
import { createClient } from "@supabase/supabase-js";
import QRCode from "react-qr-code";
import AddressAutocomplete from "@/components/menu/AddressAutocomplete";
import { useSession } from "@supabase/auth-helpers-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Zone = {
  id: string;
  min_distance_km: number;
  max_distance_km: number;
  min_order_value: number;
  cost: number;
  free_over: number | null;
  eta_min_minutes: number;
  eta_max_minutes: number;
};

// Wydziel tablicę sosów, żeby łatwo rozróżniać cenę
const SAUCES = [
  "Amerykański",
  "Ketchup",
  "Majonez",
  "Musztarda",
  "Meksykański",
  "Serowy chili",
  "Czosnkowy",
  "Musztardowo-miodowy",
  "BBQ",
];

// lista wszystkich dodatków (w tym sosów)
const AVAILABLE_ADDONS = [
  "Ser",
  "Bekon",
  "Jalapeño",
  "Ogórek",
  "Rukola",
  "Czerwona cebula",
  "Pomidor",
  "Pikle",
  ...SAUCES,
];

export default function CheckoutModal() {
  const isClient = useIsClient();
  const session = useSession();
  const isLoggedIn = !!session?.user;

  const {
    isCheckoutOpen,
    closeCheckoutModal: originalCloseCheckoutModal,
    checkoutStep,
    goToStep,
    nextStep,
    items,
    clearCart,
    removeItem,
    removeWholeItem,
    changeMeatType,
    addExtraMeat,
    removeExtraMeat,
    addAddon,
    removeAddon,
    swapIngredient,
  } = useCartStore();

  // formularz
  const [notes, setNotes] = useState<{ [key: number]: string }>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [optionalAddress, setOptionalAddress] = useState("");
  const [selectedOption, setSelectedOption] = useState<"local" | "takeaway" | "delivery" | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"Gotówka" | "Terminal" | "Online">("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [showBurger, setShowBurger] = useState(true);

  // nowe stany dla wyboru czasu
  const [deliveryTimeOption, setDeliveryTimeOption] = useState<"asap" | "schedule">("asap");
  const [scheduledTime, setScheduledTime] = useState<string>("11:30");

  // animacja burgera
  useEffect(() => {
    const id = setInterval(() => setShowBurger((b) => !b), 2000);
    return () => clearInterval(id);
  }, []);

  // prefill user data
  useEffect(() => {
    if (isLoggedIn && session) {
      setName(session.user.user_metadata?.full_name || "");
      setPhone(session.user.user_metadata?.phone || "");
      setContactEmail(session.user.email || "");
      setStreet(session.user.user_metadata?.street || "");
      setPostalCode(session.user.user_metadata?.postal_code || "");
      setCity(session.user.user_metadata?.city || "");
      setFlatNumber(session.user.user_metadata?.flat_number || "");
    }
  }, [isLoggedIn, session]);

  const closeCheckoutModal = () => {
    originalCloseCheckoutModal();
    setOrderSent(false);
    goToStep(1);
  };

  // koszty z rozróżnieniem dodatków
  const baseTotal = items.reduce((acc, it) => {
    const qty = it.quantity || 1;
    // oblicz koszt dodatków
    const addonsCost = (it.addons ?? []).reduce((sum, addon) => {
      return sum + (SAUCES.includes(addon) ? 3 : 4);
    }, 0);
    const extraMeatCost = (it.extraMeatCount || 0) * 10;
    return acc + (it.price + addonsCost + extraMeatCost) * qty;
  }, 0);

  const packagingCost = selectedOption === "takeaway" || selectedOption === "delivery" ? 2 : 0;
  const subtotal = baseTotal + packagingCost;

  // strefy i lokalizacja restauracji
  const [zones, setZones] = useState<Zone[]>([]);
  const [restLoc, setRestLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<{ cost: number; eta: string } | null>(null);

  useEffect(() => {
    supabase
      .from("delivery_zones")
      .select("*")
      .order("min_distance_km", { ascending: true })
      .then((r) => {
        if (!r.error) setZones(r.data as Zone[]);
      });
    supabase
      .from("restaurant_info")
      .select("lat,lng")
      .eq("id", 1)
      .single()
      .then((r) => {
        if (!r.error && r.data) setRestLoc({ lat: r.data.lat, lng: r.data.lng });
      });
  }, []);

  // obliczanie kosztu dostawy
  const calcDelivery = async (custLat: number, custLng: number) => {
    if (!restLoc) return;
    const resp = await fetch(
      `/api/distance?origin=${restLoc.lat},${restLoc.lng}&destination=${custLat},${custLng}`
    );
    const { distance_km, error } = await resp.json();
    if (error) return console.error("Distance API:", error);

    const zone = zones.find(
      (z) => distance_km >= z.min_distance_km && distance_km <= z.max_distance_km
    );
    if (!zone) {
      setDeliveryInfo({ cost: 0, eta: "Poza zasięgiem" });
      return;
    }

    let cost: number;
    if (zone.min_distance_km === 0) {
      cost = zone.cost;
    } else {
      cost = zone.cost * distance_km;
    }
    if (zone.free_over !== null && baseTotal >= zone.free_over) cost = 0;

    const eta = `${zone.eta_min_minutes}-${zone.eta_max_minutes} min`;
    setDeliveryInfo({ cost, eta });
  };

  // callback z autocomplete
  const onAddressSelect = (address: string, lat: number, lng: number) => {
    setStreet(address);
    calcDelivery(lat, lng);
  };

  const totalWithDelivery = subtotal + (deliveryInfo?.cost || 0);

  // wysyłka zamówienia
  const handleSubmitOrder = async () => {
    const payload = {
      items: items.map((it, i) => ({ ...it, note: notes[i] || "", quantity: it.quantity || 1 })),
     selected_option: selectedOption,
     payment_method: paymentMethod,
     user: isLoggedIn ? session!.user.id : null,
      name,
            phone,
     contact_email: contactEmail,
      // teraz wyrzucamy `address` na rzecz pola `street`
      street: selectedOption === "delivery" ? street : null,
      postal_code: selectedOption === "delivery" ? postalCode : null,
      city: selectedOption === "delivery" ? city : null,
      flat_number: selectedOption === "delivery" ? flatNumber : null,
    delivery_cost: deliveryInfo?.cost || 0,
     // upewniamy się, że trafia do kolumny client_delivery_time
      client_delivery_time:
        selectedOption === "delivery"
          ? deliveryTimeOption === "asap"
            ? "asap"
            : scheduledTime
          : null,
      total_price: totalWithDelivery,
      created_at: new Date().toISOString(),
      status: paymentMethod === "Online" ? "pending" : "placed",
    };
    const { error } = await supabase.from("orders").insert([payload]);
    if (error) {
      console.error("❌ Błąd zapisu:", error.message);
      return;
    }
    clearCart();
    setOrderSent(true);
  };

  const handleOnlinePayment = () => {
    window.location.href = "https://secure.przelewy24.pl/";
  };

  if (!isClient || !isCheckoutOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto bg-white p-6 rounded-md">
        {!orderSent && (
          <button
            onClick={closeCheckoutModal}
            className="absolute top-3 right-3 text-black hover:text-gray-700"
          >
            <X size={24} />
          </button>
        )}

        {orderSent ? (
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Dziękujemy za zamówienie!</h2>
            {showBurger ? (
              <img
                src="/animations/Animationburger.gif"
                alt="Animacja burgera"
                className="mx-auto w-40 h-40 object-contain"
              />
            ) : (
              <p className="text-xl font-semibold text-yellow-600">
                Twoje zamówienie ląduje w kuchni...
              </p>
            )}
            <QRCode value="https://g.co/kgs/47NSDMH" size={140} />
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => window.open("https://g.co/kgs/47NSDMH", "_blank")}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                Zostaw opinię
              </button>
              <button
                onClick={closeCheckoutModal}
                className="px-4 py-2 bg-gray-300 text-black rounded"
              >
                Zamknij
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* STEP 1 */}
            {checkoutStep === 1 && (
              <div>
                <h2 className="text-xl font-bold mb-4 text-center">
                  Wybierz sposób odbioru
                </h2>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {(["local", "takeaway", "delivery"] as const).map((opt) => {
                    const Icon = opt === "local" ? MapPin : opt === "takeaway" ? ShoppingBag : Truck;
                    const label =
                      opt === "local" ? "Na miejscu" : opt === "takeaway" ? "Na wynos" : "Dostawa";
                    return (
                      <button
                        key={opt}
                        onClick={() => setSelectedOption(opt)}
                        className={`flex flex-col items-center p-4 rounded-lg border ${
                          selectedOption === opt
                            ? "bg-yellow-400 text-black"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        <Icon size={24} />
                        <span className="mt-1 text-sm">{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* wybór czasu (tylko dla delivery) */}
                {selectedOption === "delivery" && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2 text-sm">Czas dostawy</h3>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="timeOption"
                          value="asap"
                          checked={deliveryTimeOption === "asap"}
                          onChange={() => setDeliveryTimeOption("asap")}
                        />
                        <span className="ml-2">Jak najszybciej</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="timeOption"
                          value="schedule"
                          checked={deliveryTimeOption === "schedule"}
                          onChange={() => setDeliveryTimeOption("schedule")}
                        />
                        <span className="ml-2">Na godzinę</span>
                      </label>
                      {deliveryTimeOption === "schedule" && (
                        <input
                          type="time"
                          className="border px-2 py-1 rounded"
                          min="11:30"
                          max="21:00"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {!isLoggedIn ? (
                    <>
                      <input
                        type="text"
                        placeholder="Email"
                        className="w-full px-3 py-2 border rounded"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <input
                        type="password"
                        placeholder="Hasło"
                        className="w-full px-3 py-2 border rounded"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        onClick={async () => {
                          const { error } =
                            await supabase.auth.signInWithPassword({
                              email,
                              password,
                            });
                          if (!error) nextStep();
                        }}
                        disabled={!email || !password || !selectedOption}
                        className="w-full bg-yellow-400 py-2 rounded font-bold disabled:opacity-50"
                      >
                        Zaloguj się
                      </button>
                      <button
                        onClick={nextStep}
                        disabled={!selectedOption}
                        className="w-full bg-black text-white py-2 rounded mt-2 disabled:opacity-50"
                      >
                        Kontynuuj bez logowania
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={nextStep}
                      className="w-full bg-black text-white py-2 rounded"
                    >
                      Kontynuuj
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {checkoutStep === 2 && (
              <div>
                <h2 className="text-xl font-bold mb-4 text-center">Dane kontaktowe</h2>
                {selectedOption === "delivery" && (
                  <>
                    <AddressAutocomplete
                      onAddressSelect={onAddressSelect}
                      setCity={setCity}
                      setPostalCode={setPostalCode}
                      setFlatNumber={setFlatNumber}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Wybierz adres z listy, aby obliczyć koszt dostawy
                    </p>
                    <div className="mt-4 space-y-2">
                      <input
                        type="text"
                        placeholder="Adres"
                        className="w-full px-3 py-2 border rounded"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Nr mieszkania"
                        className="w-full px-3 py-2 border rounded"
                        value={flatNumber}
                        onChange={(e) => setFlatNumber(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Kod pocztowy"
                        className="w-full px-3 py-2 border rounded"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Miasto"
                        className="w-full px-3 py-2 border rounded"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <input
                  type="text"
                  placeholder="Imię"
                  className="w-full mt-4 px-3 py-2 border rounded"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  type="tel"
                  placeholder="Telefon"
                  className="w-full mt-2 px-3 py-2 border rounded"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                {(selectedOption === "local" || selectedOption === "takeaway") && (
                  <>
                    <input
                      type="text"
                      placeholder="Adres (opcjonalnie)"
                      className="w-full mt-2 px-3 py-2 border rounded"
                      value={optionalAddress}
                      onChange={(e) => setOptionalAddress(e.target.value)}
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      className="w-full mt-2 px-3 py-2 border rounded"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </>
                )}
                <div className="flex justify-between mt-4">
                  <button
                    onClick={() => goToStep(1)}
                    className="px-4 py-2 bg-gray-200 rounded"
                  >
                    ← Wstecz
                  </button>
                  <button
                    onClick={nextStep}
                    disabled={
                      !name || !phone || (selectedOption === "delivery" && (!street || !postalCode || !city))
                    }
                    className="px-4 py-2 bg-yellow-400 rounded font-semibold disabled:opacity-50"
                  >
                    Dalej →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {checkoutStep === 3 && (
              <div>
                <h2 className="text-xl font-bold mb-4 text-center">
                  Podsumowanie zamówienia
                </h2>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 text-sm">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="border p-3 rounded-md bg-gray-50 relative"
                    >
                      <div className="flex justify-between items-center font-semibold mb-2">
                        <span>
                          {item.name} x{item.quantity || 1}
                        </span>
                        <span>
                          {(
                            (item.price +
                              (item.addons?.reduce((sum, addon) =>
                                sum + (SAUCES.includes(addon) ? 3 : 4), 0
                              ) || 0) +
                              (item.extraMeatCount || 0) * 10) *
                            (item.quantity || 1)
                          ).toFixed(2)}{" "}
                          zł
                        </span>
                      </div>
                      <div className="text-xs text-gray-700 space-y-2">
                        {/* Mięso */}
                        <div className="font-semibold">Mięso:</div>
                        <div className="flex gap-2">
                          <button
                            className={`px-2 py-1 rounded-md text-xs ${
                              item.meatType === "wołowina" ? "bg-yellow-300" : "bg-gray-200"
                            }`}
                            onClick={() => changeMeatType(item.name, "wołowina")}
                          >
                            Wołowina
                          </button>
                          <button
                            className={`px-2 py-1 rounded-md text-xs ${
                              item.meatType === "kurczak" ? "bg-yellow-300" : "bg-gray-200"
                            }`}
                            onClick={() => changeMeatType(item.name, "kurczak")}
                          >
                            Kurczak
                          </button>
                        </div>

                        {/* Dodatki */}
                        <div className="font-semibold mt-2">Dodatki:</div>
                        <div className="flex flex-wrap gap-2">
                          {AVAILABLE_ADDONS.map((add) => (
                            <button
                              key={add}
                              onClick={() =>
                                item.addons?.includes(add)
                                  ? removeAddon(item.name, add)
                                  : addAddon(item.name, add)
                              }
                              className={`border text-xs px-2 py-1 rounded-md ${
                                item.addons?.includes(add)
                                  ? "bg-gray-800 text-white"
                                  : "bg-white text-black"
                              }`}
                            >
                              {item.addons?.includes(add) ? `✓ ${add}` : `+ ${add}`}
                            </button>
                          ))}
                        </div>

                        {/* Extra mięso */}
                        <div className="font-semibold mt-2">Dodatkowe mięso:</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => addExtraMeat(item.name)}
                            className="px-2 py-1 text-xs bg-gray-200 rounded-md"
                          >
                            +1 mięso (+10 zł)
                          </button>
                          {item.extraMeatCount! > 0 && (
                            <button
                              onClick={() => removeExtraMeat(item.name)}
                              className="px-2 py-1 text-xs bg-red-200 rounded-md"
                            >
                              Usuń mięso
                            </button>
                          )}
                          <span className="text-xs text-gray-600">
                            Ilość: {item.extraMeatCount!}
                          </span>
                        </div>

                        {/* Swap składników */}
                        <div className="font-semibold mt-2">Wymiana składnika:</div>
                        <div className="flex flex-wrap gap-2">
                          {item.swaps?.map((sw, i) => (
                            <div
                              key={i}
                              className="bg-gray-200 text-xs px-2 py-1 rounded-md"
                            >
                              {sw.from} → {sw.to}
                            </div>
                          ))}
                          {item.availableSwaps?.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => swapIngredient(item.name, opt.from, opt.to)}
                              className="bg-white border px-2 py-1 text-xs rounded-md hover:bg-gray-100"
                            >
                              {opt.from} → {opt.to}
                            </button>
                          ))}
                        </div>

                        {/* Notatka */}
                        <textarea
                          className="w-full text-xs border rounded-md px-2 py-1 mt-2"
                          placeholder="Notatka do produktu"
                          value={notes[idx] || ""}
                          onChange={(e) =>
                            setNotes({ ...notes, [idx]: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex justify-end items-center mt-2 gap-2">
                        <button
                          onClick={() => removeItem(item.name)}
                          className="text-xs text-red-600 underline"
                        >
                          Usuń 1 szt.
                        </button>
                        <button
                          onClick={() => removeWholeItem(item.name)}
                          className="text-xs text-red-600 underline"
                        >
                          Usuń produkt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Podsumowanie kosztów */}
                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Produkty:</span>
                    <span>{baseTotal.toFixed(2)} zł</span>
                  </div>
                  {(selectedOption === "takeaway" || selectedOption === "delivery") && (
                    <div className="flex justify-between">
                      <span>Opakowanie:</span>
                      <span>2.00 zł</span>
                    </div>
                  )}
                  {deliveryInfo && (
                    <div className="flex justify-between">
                      <span>Dostawa:</span>
                      <span>{deliveryInfo.cost.toFixed(2)} zł</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>RAZEM:</span>
                    <span>{totalWithDelivery.toFixed(2)} zł</span>
                  </div>
                </div>

                {/* ETA */}
                {deliveryInfo && (
                  <p className="mt-2 text-sm text-gray-600">
                    Szacowany czas dostawy: {deliveryInfo.eta}
                  </p>
                )}

                {/* Metoda płatności */}
                <h3 className="mt-4 font-semibold">Metoda płatności</h3>
                <div className="flex gap-2 mt-2">
                  {(["Gotówka", "Terminal", "Online"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setPaymentMethod(m);
                        setShowConfirmation(false);
                      }}
                      className={`px-4 py-2 rounded font-semibold ${
                        paymentMethod === m
                          ? "bg-green-500 text-white"
                          : "bg-gray-200 text-black hover:bg-gray-300"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {!showConfirmation ? (
                  <button
                    onClick={() => setShowConfirmation(true)}
                    disabled={!paymentMethod}
                    className="w-full mt-4 py-2 bg-yellow-400 text-black rounded font-semibold disabled:opacity-50"
                  >
                    Potwierdź płatność
                  </button>
                ) : (
                  <button
                    onClick={paymentMethod === "Online" ? handleOnlinePayment : handleSubmitOrder}
                    className="w-full mt-4 py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700"
                  >
                    ✅ Zamawiam i płacę ({paymentMethod})
                  </button>
                )}

                <button
                  onClick={() => goToStep(2)}
                  className="mt-3 text-xs underline"
                >
                  ← Wróć do danych
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
