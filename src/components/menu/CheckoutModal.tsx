'use client';

import { useState } from 'react';
import { X, MapPin, ShoppingBag, Truck } from 'lucide-react';
import useIsClient from '@/lib/useIsClient';
import useCartStore from '@/store/cartStore';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CheckoutModal() {
  const isClient = useIsClient();
  const {
    isCheckoutOpen,
    closeCheckoutModal,
    checkoutStep,
    goToStep,
    nextStep,
    items,
    clearCart
  } = useCartStore();

  const [selectedOption, setSelectedOption] = useState<'local' | 'takeaway' | 'delivery' | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [orderSent, setOrderSent] = useState(false);
  const [notes, setNotes] = useState<{ [key: number]: string }>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const baseTotal = items.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);
  const packagingCost = (selectedOption === 'takeaway' || selectedOption === 'delivery') ? 2 : 0;
  const totalWithPackaging = baseTotal + packagingCost;

  if (!isClient || !isCheckoutOpen) return null;

  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => {
      setIsLoggedIn(true);
      setLoading(false);
      nextStep();
    }, 1000);
  };

  const handleSubmitOrder = async () => {
    const orderData = {
      items: items.map((item, i) => ({ ...item, note: notes[i] || '', quantity: item.quantity || 1 })),
      selectedOption,
      paymentMethod,
      user: isLoggedIn ? 'janek_burger' : null,
      name: !isLoggedIn ? name : null,
      phone: !isLoggedIn ? phone : null,
      contactEmail: !isLoggedIn ? contactEmail : null,
      address: selectedOption === 'delivery' ? { street, postalCode, city } : null,
      created_at: new Date().toISOString(),
      status: paymentMethod === 'Online' ? 'pending' : 'placed',
    };

    const { error } = await supabase.from('orders').insert([orderData]);
    if (error) console.error('Błąd Supabase:', error.message);

    clearCart();
    closeCheckoutModal();
    goToStep(1);
    setOrderSent(true);
  };

  const handleOnlinePayment = () => {
    // Redirect to Przelewy24 link (replace with real URL if needed)
    window.location.href = 'https://secure.przelewy24.pl/';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4">
      <div className="bg-white text-black rounded-xl shadow-lg w-full max-w-md relative px-6 py-8">
        {!orderSent && (
          <button onClick={closeCheckoutModal} className="absolute top-3 right-3 text-black hover:text-gray-700">
            <X />
          </button>
        )}

        {orderSent ? (
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold">Dziękujemy za zamówienie! 🍔</h2>
            <p className="text-gray-700 text-sm">Zeskanuj kod QR lub kliknij poniżej, aby zostawić opinię.</p>
            <QRCode value="https://g.co/kgs/47NSDMH" size={140} />
            <a href="https://g.co/kgs/47NSDMH" className="text-blue-600 underline text-sm" target="_blank">Zostaw opinię na Google</a>
          </div>
        ) : (
          <>
            {checkoutStep === 1 && (
              <>
                <h2 className="text-xl font-bold mb-4 text-center">Wybierz sposób odbioru</h2>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {['local', 'takeaway', 'delivery'].map((option) => {
                    const Icon = option === 'local' ? MapPin : option === 'takeaway' ? ShoppingBag : Truck;
                    const label = option === 'local' ? 'Na miejscu' : option === 'takeaway' ? 'Na wynos' : 'Dostawa';
                    return (
                      <button
                        key={option}
                        onClick={() => setSelectedOption(option as any)}
                        className={`flex flex-col items-center justify-center p-4 rounded-lg border ${
                          selectedOption === option ? 'bg-yellow-400 text-black' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <Icon size={24} />
                        <span className="text-sm mt-1">{label}</span>
                      </button>
                    );
                  })}
                </div>
                {!isLoggedIn ? (
                  <>
                    <input type="text" placeholder="Email" className="w-full mb-2 px-3 py-2 border rounded-md" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input type="password" placeholder="Hasło" className="w-full mb-4 px-3 py-2 border rounded-md" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button disabled={!selectedOption} onClick={nextStep} className="w-full bg-yellow-400 py-2 rounded-md font-bold disabled:opacity-50">Kontynuuj bez logowania</button>
                  </>
                ) : (
                  <button onClick={nextStep} className="w-full bg-black text-white py-2 rounded-md">Kontynuuj</button>
                )}
              </>
            )}

            {checkoutStep === 2 && (
              <>
                <h2 className="text-xl font-bold mb-4 text-center">Dane kontaktowe</h2>
                <input type="text" placeholder="Imię" className="w-full mb-2 px-3 py-2 border rounded-md" value={name} onChange={(e) => setName(e.target.value)} />
                <input type="tel" placeholder="Telefon" className="w-full mb-2 px-3 py-2 border rounded-md" value={phone} onChange={(e) => setPhone(e.target.value)} />
                {(selectedOption === 'local' || selectedOption === 'takeaway') && (
                  <input type="email" placeholder="Email" className="w-full mb-2 px-3 py-2 border rounded-md" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                )}
                {selectedOption === 'delivery' && (
                  <>
                    <input type="text" placeholder="Ulica" className="w-full mb-2 px-3 py-2 border rounded-md" value={street} onChange={(e) => setStreet(e.target.value)} />
                    <input type="text" placeholder="Kod pocztowy" className="w-full mb-2 px-3 py-2 border rounded-md" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                    <input type="text" placeholder="Miasto" className="w-full mb-2 px-3 py-2 border rounded-md" value={city} onChange={(e) => setCity(e.target.value)} />
                  </>
                )}
                <div className="flex justify-between pt-4">
                  <button onClick={() => goToStep(1)} className="px-4 py-2 bg-gray-200 rounded-md">← Wstecz</button>
                  <button disabled={!name || !phone || (selectedOption === 'delivery' && (!street || !postalCode || !city))} onClick={nextStep} className="px-4 py-2 bg-yellow-400 rounded-md font-semibold disabled:opacity-50">Dalej →</button>
                </div>
              </>
            )}

            {checkoutStep === 3 && (
              <>
                <h2 className="text-xl font-bold mb-4 text-center">Podsumowanie</h2>
                <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2 text-sm">
                  {items.map((item, index) => (
                    <div key={index} className="border p-3 rounded-md bg-gray-50">
                      <div className="flex justify-between font-semibold">
                        <span>{item.name} x{item.quantity || 1}</span>
                        <span>{item.price} zł</span>
                      </div>
                      <textarea
                        className="w-full text-xs border rounded-md px-2 py-1 mt-2"
                        placeholder="Notatka"
                        value={notes[index] || ''}
                        onChange={(e) => setNotes({ ...notes, [index]: e.target.value })}
                        <div className="mt-4 text-sm space-y-1">
  <div className="flex justify-between">
    <span>Suma produktów:</span>
    <span>{baseTotal.toFixed(2)} zł</span>
  </div>
  {(selectedOption === 'takeaway' || selectedOption === 'delivery') && (
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
                      />
                    </div>
                  ))}
                </div>

                <h3 className="text-md font-semibold mt-4">Metoda płatności:</h3>
                <div className="space-y-1 mt-2">
                  {['Gotówka', 'Terminal', 'Online'].map((method) => (
                    <label key={method} className="flex gap-2 items-center text-sm">
                      <input type="radio" name="payment" value={method} onChange={(e) => setPaymentMethod(e.target.value)} />
                      {method}
                    </label>
                  ))}
                </div>

                {/* Dodatkowe potwierdzenie */}
                {paymentMethod && paymentMethod !== 'Online' && !showConfirmation && (
                  <button
                    onClick={() => setShowConfirmation(true)}
                    className="w-full mt-4 bg-yellow-400 text-black py-2 rounded-md font-semibold"
                  >
                    Potwierdź złożenie zamówienia
                  </button>
                )}

                {/* Przycisk finalny */}
                {((paymentMethod === 'Online') || showConfirmation) && (
                  <button
                    onClick={paymentMethod === 'Online' ? handleOnlinePayment : handleSubmitOrder}
                    className="w-full mt-4 bg-green-600 text-white py-2 rounded-md font-semibold hover:bg-green-700"
                  >
                    ✅ Zamawiam i płacę
                  </button>
                )}

                <button onClick={() => goToStep(2)} className="mt-3 text-xs text-gray-500 underline hover:text-black">← Wróć do danych</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
