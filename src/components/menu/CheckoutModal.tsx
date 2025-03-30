"use client";

import React, { useState, useEffect } from "react";
import { X, MapPin, ShoppingBag, Truck } from "lucide-react";
import useIsClient from "@/lib/useIsClient";
import useCartStore from "@/store/cartStore";
import { createClient } from "@supabase/supabase-js";
import QRCode from "react-qr-code";
import Script from "next/script";
import AddressAutocomplete from "@/components/menu/AddressAutocomplete";

// Inicjalizacja Supabase (upewnij się, że masz skonfigurowane zmienne środowiskowe)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CheckoutModal() {
  const isClient = useIsClient();
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

  // *** Lokalny stan ***
  const [selectedOption, setSelectedOption] = useState<
    "local" | "takeaway" | "delivery" | null
  >(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [orderSent, setOrderSent] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [notes, setNotes] = useState<{ [key: number]: string }>({});

  // *** Dodajemy stan do przełączania animacji / napisu ***
  const [showBurger, setShowBurger] = useState(true);

  useEffect(() => {
    // Przełącz co 2 sekundy
    const interval = setInterval(() => {
      setShowBurger((prev) => !prev);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // *** Własna wersja closeCheckoutModal z resetem stanu ***
  const closeCheckoutModal = () => {
    originalCloseCheckoutModal(); // wywołaj oryginalną logikę (setIsCheckoutOpen(false) w store)
    setOrderSent(false);
    goToStep(1);
  };

  // *** Obliczenia cen ***
  const baseTotal = items.reduce((acc, item) => {
    const quantity = item.quantity || 1;
    const addonsCost = (item.addons?.length || 0) * 3;
    const extraMeatCost = (item.extraMeatCount || 0) * 10;
    return acc + (item.price + addonsCost + extraMeatCost) * quantity;
  }, 0);

  const packagingCost =
    selectedOption === "takeaway" || selectedOption === "delivery" ? 2 : 0;
  const totalWithPackaging = baseTotal + packagingCost;

  // *** Obsługa zamówienia ***
  const handleSubmitOrder = async () => {
    const baseTotal = items.reduce((acc, item) => {
      const quantity = item.quantity || 1;
      const addonsCost = (item.addons?.length || 0) * 3;
      const extraMeatCost = (item.extraMeatCount || 0) * 10;
      return acc + (item.price + addonsCost + extraMeatCost) * quantity;
    }, 0);
  
    const packagingCost =
      selectedOption === "takeaway" || selectedOption === "delivery" ? 2 : 0;
    const totalWithPackaging = baseTotal + packagingCost;
  
    console.log("Base Total:", baseTotal);
    console.log("Packaging Cost:", packagingCost);
    console.log("Total with Packaging:", totalWithPackaging);
  
    const orderData = {
      items: items.map((item, i) => ({
        ...item,
        note: notes[i] || "",
        quantity: item.quantity || 1,
      })),
      selected_option: selectedOption,
      payment_method: paymentMethod,
      user: isLoggedIn ? "janek_burger" : null,
      name: !isLoggedIn ? name : null,
      phone: !isLoggedIn ? phone : null,
      contact_email: !isLoggedIn ? contactEmail : null,
      street: selectedOption === "delivery" ? street : null,
      postal_code: selectedOption === "delivery" ? postalCode : null,
      city: selectedOption === "delivery" ? city : null,
      flat_number: selectedOption === "delivery" ? flatNumber : null,
      total_price: totalWithPackaging,
      products: items.map((item) => item.name).join(", "),
      address:
        selectedOption === "delivery"
          ? `${street}, ${city}, ${postalCode}${flatNumber ? `, ${flatNumber}` : ""}`
          : null,
      created_at: new Date().toISOString(),
      status: paymentMethod === "Online" ? "pending" : "placed",
    };
  
    console.log("Order Data przed wysłaniem:", orderData);
  
    const { error } = await supabase.from("orders").insert([orderData]);
    if (error) {
      console.error("Błąd przy zapisie zamówienia:", error.message);
      return;
    }
  
    clearCart();
    setOrderSent(true);
  };
  

  const handleOnlinePayment = () => {
    // Przekierowanie na zewnętrzną bramkę płatności
    window.location.href = "https://secure.przelewy24.pl/";
  };

  // Funkcje usuwania z koszyka
  const handleRemoveOneItem = (index: number) => removeItem(items[index].name);
  const handleRemoveWholeItem = (index: number) =>
    removeWholeItem(items[index].name);

  // Zabezpieczenie przed SSR i gdy modal zamknięty
  if (!isClient || !isCheckoutOpen) return null;

  return (
    <>
      {/* Załadowanie Google Maps API do AddressAutocomplete */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="beforeInteractive"
      />

      {/* Główny kontener cieniujący tło */}
      <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4">
        
        {/* Wnętrze modala */}
        <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto bg-white p-6 rounded-md">
          {/* Przycisk X – pojawia się tylko, gdy zamówienie jeszcze nie jest wysłane */}
          {!orderSent && (
            <button
              onClick={closeCheckoutModal}
              className="absolute top-3 right-3 text-black hover:text-gray-700"
            >
              <X />
            </button>
          )}

          {/* Jeśli orderSent = true => ekran podziękowania */}
          {orderSent ? (
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold">Dziękujemy za zamówienie!</h2>

              {/* Animacja przełączana z napisem */}
              <div>
              {showBurger ? (
  <img
    src="/animations/Animationburger.gif"
    alt="Animacja burgera"
    className="mx-auto w-40 h-40 object-contain"
  />
) : (
  <p className="text-xl font-semibold text-yellow-600">
    Twoje Zamówienie właśnie ląduje w kuchni...
                  </p>
                )}
              </div>

              {/* Kod QR wyśrodkowany */}
              <div className="flex justify-center">
                <QRCode value="https://g.co/kgs/47NSDMH" size={140} />
              </div>

              {/* Dwa przyciski na dole */}
              <div className="flex gap-4 justify-center mt-4">
                <button
                  onClick={() =>
                    window.open("https://g.co/kgs/47NSDMH", "_blank")
                  }
                  className="py-2 px-4 bg-blue-500 text-white font-bold rounded-md"
                >
                  Zostaw opinię
                </button>
                <button
                  onClick={closeCheckoutModal}
                  className="py-2 px-4 bg-gray-300 text-black rounded-md"
                >
                  Zamknij
                </button>
              </div>
            </div>
          ) : (
            <>

              {/* KROK 1 – Sposób odbioru, logowanie */}
              {checkoutStep === 1 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 text-center">
                    Wybierz sposób odbioru
                  </h2>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {["local", "takeaway", "delivery"].map((option) => {
                      const Icon =
                        option === "local"
                          ? MapPin
                          : option === "takeaway"
                          ? ShoppingBag
                          : Truck;
                      const label =
                        option === "local"
                          ? "Na miejscu"
                          : option === "takeaway"
                          ? "Na wynos"
                          : "Dostawa";
                      return (
                        <button
                          key={option}
                          onClick={() => setSelectedOption(option as any)}
                          className={`flex flex-col items-center justify-center p-4 rounded-lg border ${
                            selectedOption === option
                              ? "bg-yellow-400 text-black"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          <Icon size={24} />
                          <span className="text-sm mt-1">{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-2">
                    {!isLoggedIn ? (
                      <>
                        <input
                          type="text"
                          placeholder="Email"
                          className="w-full px-3 py-2 border rounded-md"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                        <input
                          type="password"
                          placeholder="Hasło"
                          className="w-full px-3 py-2 border rounded-md"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          onClick={() => setIsLoggedIn(true)}
                          className="w-full bg-yellow-400 py-2 rounded-md font-bold disabled:opacity-50"
                          disabled={!email || !password || !selectedOption}
                        >
                          Zaloguj się
                        </button>
                        <button
                          onClick={nextStep}
                          className="w-full bg-black text-white py-2 rounded-md mt-2 disabled:opacity-50"
                          disabled={!selectedOption}
                        >
                          Kontynuuj bez logowania
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={nextStep}
                        className="w-full bg-black text-white py-2 rounded-md"
                      >
                        Kontynuuj
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* KROK 2 – Dane kontaktowe (i ewentualny adres przy "delivery") */}
              {checkoutStep === 2 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 text-center">
                    Dane kontaktowe
                  </h2>

                  {selectedOption === "delivery" && (
                    <>
                      <AddressAutocomplete
                        setStreet={setStreet}
                        setCity={setCity}
                        setPostalCode={setPostalCode}
                        setFlatNumber={setFlatNumber}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Wybierz adres z listy, aby uzupełnić dane
                      </p>

                      <div className="grid grid-cols-1 gap-2 mt-4">
                        <input
                          type="text"
                          placeholder="Adres"
                          className="px-3 py-2 border rounded-md"
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Nr mieszkania/lokalu"
                          className="px-3 py-2 border rounded-md"
                          value={flatNumber}
                          onChange={(e) => setFlatNumber(e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Kod pocztowy"
                          className="px-3 py-2 border rounded-md"
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Miasto"
                          className="px-3 py-2 border rounded-md"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {/* Pola wspólne */}
                  <input
                    type="text"
                    placeholder="Imię"
                    className="w-full mt-4 px-3 py-2 border rounded-md"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <input
                    type="tel"
                    placeholder="Telefon"
                    className="w-full mt-2 px-3 py-2 border rounded-md"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />

                  {/* Email opcjonalnie przy local/takeaway */}
                  {(selectedOption === "local" ||
                    selectedOption === "takeaway") && (
                    <input
                      type="email"
                      placeholder="Email"
                      className="w-full mt-2 px-3 py-2 border rounded-md"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  )}

                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => goToStep(1)}
                      className="px-4 py-2 bg-gray-200 rounded-md"
                    >
                      ← Wstecz
                    </button>
                    <button
                      disabled={
                        !name ||
                        !phone ||
                        (selectedOption === "delivery" &&
                          (!street || !postalCode || !city))
                      }
                      onClick={nextStep}
                      className="px-4 py-2 bg-yellow-400 rounded-md font-semibold disabled:opacity-50"
                    >
                      Dalej →
                    </button>
                  </div>
                </div>
              )}

              {/* KROK 3 – Podsumowanie zamówienia, wybór płatności */}
              {checkoutStep === 3 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 text-center">
                    Podsumowanie zamówienia
                  </h2>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 text-sm">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="border p-3 rounded-md bg-gray-50 relative"
                      >
                        <div className="flex justify-between items-center font-semibold mb-2">
                          <span>
                            {item.name} x{item.quantity || 1}
                          </span>
                          <span>
                            {(
                              (item.price +
                                (item.addons?.length || 0) * 3 +
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
                                item.meatType === "wołowina"
                                  ? "bg-yellow-300"
                                  : "bg-gray-200"
                              }`}
                              onClick={() =>
                                changeMeatType(item.name, "wołowina")
                              }
                            >
                              Wołowina
                            </button>
                            <button
                              className={`px-2 py-1 rounded-md text-xs ${
                                item.meatType === "kurczak"
                                  ? "bg-yellow-300"
                                  : "bg-gray-200"
                              }`}
                              onClick={() =>
                                changeMeatType(item.name, "kurczak")
                              }
                            >
                              Kurczak
                            </button>
                          </div>

                          {/* Dodatki */}
                          <div className="font-semibold mt-2">Dodatki:</div>
                          <div className="flex flex-wrap gap-2">
                            {[
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
                            ].map((addon) => (
                              <button
                                key={addon}
                                onClick={() =>
                                  item.addons?.includes(addon)
                                    ? removeAddon(item.name, addon)
                                    : addAddon(item.name, addon)
                                }
                                className={`border text-xs px-2 py-1 rounded-md ${
                                  item.addons?.includes(addon)
                                    ? "bg-gray-800 text-white"
                                    : "bg-white text-black"
                                }`}
                              >
                                {item.addons?.includes(addon)
                                  ? `✓ ${addon}`
                                  : `+ ${addon}`}
                              </button>
                            ))}
                          </div>

                          {/* Dodatkowe mięso */}
                          <div className="font-semibold mt-2">
                            Dodatkowe mięso:
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => addExtraMeat(item.name)}
                              className="px-2 py-1 text-xs bg-gray-200 rounded-md"
                            >
                              +1 mięso (+10 zł)
                            </button>
                            {item.extraMeatCount > 0 && (
                              <button
                                onClick={() => removeExtraMeat(item.name)}
                                className="px-2 py-1 text-xs bg-red-200 rounded-md"
                              >
                                Usuń mięso
                              </button>
                            )}
                            <span className="text-xs text-gray-600">
                              Ilość: {item.extraMeatCount || 0}
                            </span>
                          </div>

                          {/* Wymiana składników */}
                          <div className="font-semibold mt-2">
                            Wymiana składnika:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {item.swaps?.map((sw, i) => (
                              <div
                                key={i}
                                className="bg-gray-200 text-xs px-2 py-1 rounded-md"
                              >
                                {sw.from} → {sw.to}
                              </div>
                            ))}
                            {item.availableSwaps?.map((swapOption, i) => (
                              <button
                                key={i}
                                onClick={() =>
                                  swapIngredient(
                                    item.name,
                                    swapOption.from,
                                    swapOption.to
                                  )
                                }
                                className="bg-white border px-2 py-1 text-xs rounded-md hover:bg-gray-100"
                              >
                                {swapOption.from} → {swapOption.to}
                              </button>
                            ))}
                          </div>

                          {/* Notatka */}
                          <textarea
                            className="w-full text-xs border rounded-md px-2 py-1 mt-2"
                            placeholder="Notatka do produktu"
                            value={notes[index] || ""}
                            onChange={(e) =>
                              setNotes({ ...notes, [index]: e.target.value })
                            }
                          />
                        </div>

                        {/* Usuń */}
                        <div className="flex justify-end items-center mt-2 gap-2">
                          <button
                            onClick={() => handleRemoveOneItem(index)}
                            className="text-xs text-red-600 underline"
                          >
                            Usuń 1 szt.
                          </button>
                          <button
                            onClick={() => handleRemoveWholeItem(index)}
                            className="text-xs text-red-600 underline"
                          >
                            Usuń produkt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Podsumowanie cenowe */}
                  <div className="mt-4 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Suma produktów:</span>
                      <span>{baseTotal.toFixed(2)} zł</span>
                    </div>
                    {(selectedOption === "takeaway" ||
                      selectedOption === "delivery") && (
                      <div className="flex justify-between">
                        <span>Opakowanie:</span>
                        <span>2.00 zł</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                      <span>Razem do zapłaty:</span>
                      <span>{totalWithPackaging.toFixed(2)} zł</span>
                    </div>
                  </div>

                  {/* Wybór metody płatności */}
                  <h3 className="text-md font-semibold mt-4">
                    Metoda płatności:
                  </h3>
                  <div className="flex gap-2 mt-2">
                    {["Gotówka", "Terminal", "Online"].map((method) => {
                      const isSelected = paymentMethod === method;
                      return (
                        <button
                          key={method}
                          onClick={() => {
                            setPaymentMethod(method);
                            setShowConfirmation(false);
                          }}
                          className={`px-4 py-2 rounded-md font-semibold ${
                            isSelected
                              ? "bg-green-500 text-white"
                              : "bg-gray-200 text-black hover:bg-gray-300"
                          }`}
                        >
                          {method}
                        </button>
                      );
                    })}
                  </div>

                  {/* Potwierdzenie płatności */}
                  {paymentMethod &&
                    (!showConfirmation ? (
                      <button
                        onClick={() => setShowConfirmation(true)}
                        className="w-full mt-4 bg-yellow-400 text-black py-2 rounded-md font-semibold"
                      >
                        Potwierdź{" "}
                        {paymentMethod === "Online"
                          ? "płatność online"
                          : "metodę płatności"}
                      </button>
                    ) : (
                      <button
                        onClick={
                          paymentMethod === "Online"
                            ? handleOnlinePayment
                            : handleSubmitOrder
                        }
                        className="w-full mt-4 bg-green-600 text-white py-2 rounded-md font-semibold hover:bg-green-700"
                      >
                        ✅ Zamawiam i płacę ({paymentMethod})
                      </button>
                    ))}

                  <button
                    onClick={() => goToStep(2)}
                    className="mt-3 text-xs text-gray-500 underline hover:text-black"
                  >
                    ← Wróć do danych
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
