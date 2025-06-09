"use client";

import React, { useState, useEffect, memo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSession } from "@supabase/auth-helpers-react";
import { ShoppingCart, User, X } from "lucide-react";
import useCartStore from "../store/cartStore";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import AddressAutocomplete from "@/components/menu/AddressAutocomplete";

const supabase = createClientComponentClient();

// RegistrationModal
const RegistrationModal = memo(({
  onClose,
  handleSubmitRegister,
  fullName, setFullName,
  phone, setPhone,
  email, setEmail,
  password, setPassword,
  confirmPassword, setConfirmPassword,
  captchaChecked, setCaptchaChecked,
  acceptTerms, setAcceptTerms,
}: {
  onClose: () => void;
  handleSubmitRegister: (e: React.FormEvent) => Promise<void>;
  fullName: string; setFullName: React.Dispatch<React.SetStateAction<string>>;
  phone: string; setPhone: React.Dispatch<React.SetStateAction<string>>;
  email: string; setEmail: React.Dispatch<React.SetStateAction<string>>;
  password: string; setPassword: React.Dispatch<React.SetStateAction<string>>;
  confirmPassword: string; setConfirmPassword: React.Dispatch<React.SetStateAction<string>>;
  captchaChecked: boolean; setCaptchaChecked: React.Dispatch<React.SetStateAction<boolean>>;
  acceptTerms: boolean; setAcceptTerms: React.Dispatch<React.SetStateAction<boolean>>;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="bg-white p-6 rounded-lg max-w-md w-full relative max-h-[80vh] overflow-y-auto">
      <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-black">
        <X size={20} />
      </button>
      <h2 className="text-xl font-bold mb-4 text-center">Utwórz konto</h2>
      <form onSubmit={handleSubmitRegister} className="space-y-4">
        <input type="text" placeholder="Imię i nazwisko" className="w-full border rounded-lg px-3 py-2"
          value={fullName} onChange={e => setFullName(e.target.value)} required />
        <input type="tel" placeholder="Telefon (9 cyfr)" pattern="^\d{9}$" className="w-full border rounded-lg px-3 py-2"
          value={phone} onChange={e => setPhone(e.target.value)} required />
        <input type="email" placeholder="Email" className="w-full border rounded-lg px-3 py-2"
          value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="Hasło" className="w-full border rounded-lg px-3 py-2"
          value={password} onChange={e => setPassword(e.target.value)} required />
        <input type="password" placeholder="Powtórz hasło" className="w-full border rounded-lg px-3 py-2"
          value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
        <div className="flex items-center">
          <input type="checkbox" checked={captchaChecked} onChange={e => setCaptchaChecked(e.target.checked)} required className="mr-2" />
          <span className="text-sm">Nie jestem robotem</span>
        </div>
        <div className="flex items-center">
          <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} required className="mr-2" />
          <span className="text-sm">Akceptuję regulamin</span>
        </div>
        <button type="submit" className="w-full py-2 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600">
          Zarejestruj się
        </button>
      </form>
    </div>
  </div>
));
RegistrationModal.displayName = "RegistrationModal";

// Pomocnicze komponenty dla zakładek
function OrdersHistory({ onRepeat }: { onRepeat: (o:any) => void }) {
  const session = useSession();
  const userId = session?.user?.id;
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => { if (!error && data) setOrders(data); });
  }, [userId]);

  if (orders.length === 0) {
    return <p className="text-center">Brak ukończonych zamówień.</p>;
  }

  return (
    <div className="space-y-3">
      {orders.map(o => (
        <div key={o.id} className="border p-3 rounded-lg flex justify-between items-center">
          <div>
            <p className="font-semibold">#{o.id}</p>
            <p>{new Date(o.created_at).toLocaleString()}</p>
          </div>
          <button onClick={() => onRepeat(o)}
            className="py-1 px-3 bg-black text-white rounded hover:bg-gray-800">
            Zamów ponownie
          </button>
        </div>
      ))}
    </div>
  );
}

function LoyaltyProgram() {
  const session = useSession();
  const userId = session?.user?.id;
  const [stamps, setStamps] = useState(0);
  const goal = 10;

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("loyalty")
      .select("stamps")
      .eq("user_id", userId)
      .single()
      .then(({ data, error }) => { if (!error && data) setStamps(data.stamps || 0); });
  }, [userId]);

  return (
    <div className="space-y-4 text-center">
      <p>
        Zdobyłeś <strong>{stamps}</strong> naklejek — do nagrody:{" "}
        <strong>{Math.max(goal - stamps, 0)}</strong>
      </p>
      <div className="flex justify-center space-x-2">
        {[...Array(goal)].map((_, i) => (
          <div key={i}
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
              i < stamps ? "bg-yellow-400 border-yellow-600" : "bg-gray-200 border-gray-400"
            }`}>
            {i < stamps ? "✔️" : i + 1}
          </div>
        ))}
      </div>
      <div className="h-2 bg-gray-300 rounded overflow-hidden mx-auto max-w-sm">
        <div className="h-full bg-yellow-500"
          style={{ width: `${Math.min((stamps/goal)*100,100)}%` }} />
      </div>
    </div>
  );
}

export default function FloatingAuthButtons() {
  const router = useRouter();
  const session = useSession();
  const isLoggedIn = !!session?.user;

  const toggleCart = useCartStore(s => s.toggleCart);
  const items = useCartStore(s => s.items);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const [modalType, setModalType] = useState<"small"|"large">("small");
  const [showModal, setShowModal] = useState(false);

  // logowanie
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmitLogin = async(e:React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert("Błąd logowania: "+error.message);

    // sprawdź rolę
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) return alert("Brak użytkownika");
    const { data:profile } = await supabase
      .from("profiles").select("role").eq("id",user.id).maybeSingle();
    const role = profile?.role;
    if (role==="admin"||role==="employee") {
      alert("Jesteś pracownikiem → Panel Admina");
      return router.push("/admin");
    }
    alert("Zalogowano pomyślnie!");
    setShowModal(false);
    router.refresh();
  };

  // rejestracja…
  const [fullName,setFullName] = useState("");
  const [phone,setPhone] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [captchaChecked,setCaptchaChecked] = useState(false);
  const [acceptTerms,setAcceptTerms] = useState(false);

  const handleSubmitRegister = async(e:React.FormEvent) => {
    e.preventDefault();
    if(password!==confirmPassword) return alert("Hasła muszą być identyczne");
    const { error:signUpError } = await supabase.auth.signUp(
      { email,password },
      { emailRedirectTo:`${window.location.origin}/verify`, data:{ role:"client", full_name:fullName, phone } }
    );
    if (signUpError) return alert("Błąd: "+signUpError.message);
    await supabase.auth.updateUser({ data:{ full_name:fullName, phone } });
    alert("Zarejestrowano! Potwierdź email i zaloguj się.");
    setShowModal(false);
  };

  // wylogowanie
  const handleLogout = async() => {
    const { error } = await supabase.auth.signOut();
    if (error) alert("Błąd wylogowania: "+error.message);
    else { alert("Wylogowano"); router.refresh(); setShowModal(false); }
  };

  // Mały panel klienta / logowanie
  const SmallAuthModal = ({ onClose }: {onClose:()=>void}) => (
    <div className="fixed bottom-20 right-6 z-50 w-72 bg-white border shadow-lg p-4 rounded-lg">
      <button onClick={onClose} className="absolute top-2 right-2 text-gray-500"><X size={18}/></button>
      <h2 className="text-lg font-bold mb-3 text-center">Zaloguj się</h2>
      <form onSubmit={handleSubmitLogin} className="space-y-3">
        <input type="email" placeholder="Email" className="w-full border rounded px-3 py-2"
          value={email} onChange={e=>setEmail(e.target.value)} required />
        <input type="password" placeholder="Hasło" className="w-full border rounded px-3 py-2"
          value={password} onChange={e=>setPassword(e.target.value)} required />
        <button type="submit" className="w-full py-2 bg-yellow-500 text-white rounded-lg">
          Zaloguj się
        </button>
      </form>
      <p className="mt-3 text-center text-sm">
        Nie masz konta?{" "}
        <button onClick={()=>setModalType("large")} className="text-blue-500 underline">
          Zarejestruj się
        </button>
      </p>
    </div>
  );

  // Mały panel po zalogowaniu (klient)
  const SmallClientModal = ({ onClose }: {onClose:()=>void}) => {
    const name = session?.user?.user_metadata?.full_name || session?.user?.email;
    return (
      <div className="fixed bottom-20 right-6 z-50 w-72 bg-white border shadow-lg p-4 rounded-lg">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500"><X size={18}/></button>
        <p className="text-center mb-3 font-semibold">Hej {name}!</p>
        <div className="flex flex-col gap-2">
          <button onClick={()=>{router.push("/#menu"); onClose()}}
            className="w-full py-2 bg-yellow-500 text-white rounded-lg">
            Nowe zamówienie
          </button>
          <button onClick={()=>{setModalType("large");}}
            className="w-full py-2 border border-black rounded-lg">
            Historia zamówień
          </button>
          <button onClick={()=>{setModalType("large");}}
            className="w-full py-2 bg-black text-white rounded-lg">
            Panel Klienta
          </button>
          <button onClick={handleLogout}
            className="w-full py-2 border border-red-500 text-red-500 rounded-lg">
            Wyloguj się
          </button>
        </div>
      </div>
    );
  };

  // Duży panel klienta z zakładkami
  const ClientPanelWithTabs = ({ onClose }:{onClose:()=>void}) => {
    const session = useSession();
    const name = session?.user?.user_metadata?.full_name || session?.user?.email;
    const [tab, setTab] = useState<"orders"|"loyalty"|"settings">("orders");

    // stany do ustawień
    const [localName, setLocalName] = useState(session?.user?.user_metadata?.full_name||"");
    const [localPhone, setLocalPhone] = useState(session?.user?.user_metadata?.phone||"");
    const [localEmail, setLocalEmail] = useState(session?.user?.email||"");
    const [localAddress, setLocalAddress] = useState(session?.user?.user_metadata?.address||"");
    const [oldPass, setOldPass] = useState("");
    const [newPass, setNewPass] = useState("");
    const [newPass2, setNewPass2] = useState("");

    const repeatOrder = async(o:any) => {
      await supabase.from("orders").insert([{ user_id: session!.user!.id, order_items: o.order_items, status:"pending" }]);
      alert("Zamówienie ponowione!");
    };

    const handleSaveSettings = async(e:React.FormEvent) => {
      e.preventDefault();
      // walidacja haseł
      if (newPass || newPass2) {
        if (newPass !== newPass2) return alert("Nowe hasła nie pasują!");
        // weryfikacja starego
        const { error:reauthErr } = await supabase.auth.signInWithPassword({
          email: localEmail, password: oldPass
        });
        if (reauthErr) return alert("Stare hasło nieprawidłowe!");
        // aktualizacja hasła
        const { error:updErr } = await supabase.auth.updateUser({ password: newPass });
        if (updErr) return alert("Błąd zmiany hasła: "+updErr.message);
      }
      // aktualizacja user_metadata (name, phone, address)
      const { error:updMeta } = await supabase.auth.updateUser({
        data:{ full_name:localName, phone:localPhone, address:localAddress }
      });
      if (updMeta) return alert("Błąd zapisu profilu: "+updMeta.message);
      alert("Ustawienia zapisane!");
      onClose();
    };

    let content;
    if (tab === "orders") {
      content = <OrdersHistory onRepeat={repeatOrder} />;
    } else if (tab === "loyalty") {
      content = <LoyaltyProgram />;
    } else {
      content = (
        <form className="space-y-4" onSubmit={handleSaveSettings}>
          <input type="text" placeholder="Imię i nazwisko" className="w-full border rounded px-3 py-2"
            value={localName} onChange={e=>setLocalName(e.target.value)} required />
          <input type="tel" placeholder="Telefon" className="w-full border rounded px-3 py-2"
            value={localPhone} onChange={e=>setLocalPhone(e.target.value)} required />
          <input type="email" placeholder="Email" className="w-full border rounded px-3 py-2"
            value={localEmail} onChange={e=>setLocalEmail(e.target.value)} required />
          <AddressAutocomplete value={localAddress} onSelect={setLocalAddress} />
          <hr />
          <input type="password" placeholder="Stare hasło" className="w-full border rounded px-3 py-2"
            value={oldPass} onChange={e=>setOldPass(e.target.value)} />
          <input type="password" placeholder="Nowe hasło" className="w-full border rounded px-3 py-2"
            value={newPass} onChange={e=>setNewPass(e.target.value)} />
          <input type="password" placeholder="Powtórz nowe hasło" className="w-full border rounded px-3 py-2"
            value={newPass2} onChange={e=>setNewPass2(e.target.value)} />
          <button type="submit" className="w-full py-2 bg-yellow-500 text-white rounded-lg">
            Zapisz zmiany
          </button>
        </form>
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white p-4 rounded-lg max-w-lg w-full relative max-h-[80vh] overflow-y-auto">
          <button onClick={onClose} className="absolute top-3 right-3 text-gray-500"><X size={20}/></button>
          <div className="flex justify-between mb-4">
            {["orders","loyalty","settings"].map(t => (
              <button key={t}
                onClick={()=>setTab(t as any)}
                className={`px-4 py-2 font-semibold ${tab===t?"border-b-2 border-black":""}`}>
                {t==="orders"?"Historia zamówień": t==="loyalty"?"Program lojalnościowy":"Ustawienia"}
              </button>
            ))}
          </div>
          <div className="mb-4">{content}</div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* przyciski */}
      <div className="fixed bottom-6 right-6 z-50 flex space-x-4 pointer-events-auto">
        <button onClick={()=>{ setModalType("small"); setShowModal(true); }}
          className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center hover:scale-105 transition">
          <User className="text-black w-5 h-5" />
        </button>
        <button onClick={()=>toggleCart()} className="w-14 h-14 rounded-full bg-white shadow flex items-center justify-center hover:scale-105 transition relative">
          <ShoppingCart className="text-black w-6 h-6"/>
          {itemCount>0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {itemCount}
          </span>}
        </button>
      </div>

      {showModal && (
        modalType==="small"
          ? ( isLoggedIn
              ? <SmallClientModal onClose={()=>setShowModal(false)} />
              : <SmallAuthModal onClose={()=>setShowModal(false)} /> )
          : ( isLoggedIn
              ? <ClientPanelWithTabs onClose={()=>setShowModal(false)} />
              : <RegistrationModal
                  onClose={()=>setShowModal(false)}
                  handleSubmitRegister={handleSubmitRegister}
                  fullName={fullName} setFullName={setFullName}
                  phone={phone} setPhone={setPhone}
                  email={email} setEmail={setEmail}
                  password={password} setPassword={setPassword}
                  confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
                  captchaChecked={captchaChecked} setCaptchaChecked={setCaptchaChecked}
                  acceptTerms={acceptTerms} setAcceptTerms={setAcceptTerms}
                /> )
      )}
    </>
  );
}
