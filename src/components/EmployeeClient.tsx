// src/app/components/EmployeeClient.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import AcceptButton from "./AcceptButton";
import EditOrderButton from "@/components/EditOrderButton";
import CancelButton from "@/components/CancelButton";
import CountdownTimer from "@/components/CountdownTimer";
import productsData from "@/data/product.json";

interface Order {
  id: string;
  customer_name: string;
  total_price: number;
  created_at: string;
  status: "new" | "placed" | "accepted" | "cancelled" | "completed";
  /** czas wybrany przez klienta przy składaniu (delivery_time) */
  clientDelivery?: string;
  /** czas ustawiony przez pracownika (employee_delivery_time) */
  deliveryTime?: string;
  address: string;
  phone: string;
  items: any;
  selected_option?: "local" | "takeaway" | "delivery";
}

function getOptionLabel(opt?: Order["selected_option"]) {
  if (opt === "local")    return "NA MIEJSCU";
  if (opt === "takeaway") return "NA WYNOS";
  if (opt === "delivery") return "DOSTAWA";
  return "BRAK";
}

function parseProducts(itemsData: any): any[] {
  if (!itemsData) return [];
  if (Array.isArray(itemsData)) return itemsData;
  if (typeof itemsData === "object") {
    return Array.isArray(itemsData.items) ? itemsData.items : [itemsData];
  }
  if (typeof itemsData === "string") {
    const t = itemsData.trim();
    if (t.startsWith("[")) {
      try { return JSON.parse(t); } catch { return []; }
    }
    return t.split(",").map(n => ({ name: n.trim(), quantity: 1, price: 0 }));
  }
  return [];
}

function findProductDetails(name: string) {
  for (const cat of productsData) {
    for (const sub of cat.subcategories || []) {
      const f = sub.items?.find((i:any)=>i.name===name);
      if (f) return f;
    }
    const f = cat.items?.find((i:any)=>i.name===name);
    if (f) return f;
  }
  return null;
}

function getBorderClass(status: Order["status"]) {
  switch (status) {
    case "new":
    case "placed":    return "border-2 border-blue-500";
    case "accepted":  return "border-2 border-green-500";
    case "cancelled": return "border-2 border-red-500";
    case "completed": return "border-2 border-gray-500";
    default:          return "border-2 border-gray-300";
  }
}

const ProductDetailsModal: React.FC<{ product: any; onClose(): void }> = ({ product, onClose }) => {
  const title = product.quantity > 1
    ? `${product.name} x${product.quantity}`
    : product.name;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full border shadow-lg">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        {product.description && <p className="mb-2"><strong>Opis:</strong> {product.description}</p>}
        {product.ingredients?.length > 0 && (
          <div>
            <strong>Składniki:</strong>
            <ul className="list-disc list-inside mt-2">
              {product.ingredients.map((ing:string,i:number)=><li key={i}>{ing}</li>)}
            </ul>
          </div>
        )}
        {product.addons?.length > 0 && (
          <div className="mt-4">
            <strong>Dodatki:</strong>
            <ul className="list-disc list-inside mt-2">
              {product.addons.map((a:string,i:number)=><li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
        <button onClick={onClose} className="mt-4 bg-red-600 hover:bg-red-500 text-white py-1 px-4 rounded-full">
          Zamknij
        </button>
      </div>
    </div>
  );
};

const ProductItem: React.FC<{ prod: any }> = ({ prod }) => (
  <div className="border p-2 rounded-md mb-2">
    <div className="flex justify-between">
      <span className="font-semibold">{prod.name} – {prod.price} zł</span>
      <span className="text-sm">Ilość: {prod.quantity}</span>
    </div>
    <div className="mt-2">
      <strong>Dodatki:</strong>{" "}
      {prod.addons?.length
        ? <ul className="list-disc list-inside ml-4">
            {prod.addons.map((a:string,i:number)=><li key={i}>{a}</li>)}
          </ul>
        : <span className="ml-2">Brak</span>}
    </div>
    <div className="mt-2">
      <strong>Dodatkowe mięso:</strong> {prod.extraMeatCount||0} por.
    </div>
  </div>
);

function renderOrderDetails(order: Order, setSel: (p:any)=>void) {
  const prods = parseProducts(order.items);
  return (
    <div className="text-sm mt-2">
      <p><strong>Kwota:</strong> {order.total_price} zł</p>
      <p><strong>Adres:</strong> {order.address}</p>
      <p><strong>Telefon:</strong> {order.phone}</p>
      <div className="mt-2">
        <strong>Produkty:</strong>
        {prods.length===0
          ? <span> brak</span>
          : (
            <ul className="space-y-2 mt-1">
              {prods.map((p,i)=>(
                <li key={i}>
                  <ProductItem prod={p}/>
                  <button
                    onClick={()=>{
                      const d = findProductDetails(p.name);
                      if (d) setSel({ ...d, ...p });
                    }}
                    className="text-sm text-blue-500 underline hover:text-blue-400 mt-1"
                  >Szczegóły</button>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}

export default function EmployeeClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;
  const [totalCount, setTotalCount] = useState(0);

  const [filterStatus, setFilterStatus] = useState<"all"|Order["status"]>("all");
  const [filterOption, setFilterOption] = useState<"all"|Order["selected_option"]>("all");
  const [sortOrder, setSortOrder] = useState<"asc"|"desc">("desc");

  const prevCount = useRef(0);
  const audioRef = useRef<HTMLAudioElement|null>(null);
  useEffect(()=>{ audioRef.current = new Audio("/new-order.mp3"); }, []);

  async function fetchOrders() {
    setLoading(true);
    try {
      const offset = (currentPage-1)*ordersPerPage;
      const res = await fetch(`/api/orders/current?limit=${ordersPerPage}&offset=${offset}`);
      if (!res.ok) throw new Error(res.statusText);
      const { orders: raw, totalCount } = await res.json();
      const mapped:Order[] = raw.map((o:any)=>({
        id: o.id,
        customer_name: o.customer_name,
        total_price: o.total_price,
        created_at: o.created_at,
        status: o.status,
        clientDelivery: o.delivery_time,
        deliveryTime: o.employee_delivery_time,
        address: o.address,
        phone: o.phone,
        items: o.items,
        selected_option: o.selected_option,
      }));
      setOrders(mapped);
      setTotalCount(totalCount);
      // play sound
      const newN = mapped.filter(o=>o.status==="new"||o.status==="placed").length;
      if (newN>prevCount.current && audioRef.current) audioRef.current.play().catch(()=>{});
      prevCount.current = newN;
    } catch(e) {
      console.error("Błąd pobierania:",e);
    } finally { setLoading(false); }
  }
  useEffect(()=>{ fetchOrders(); }, [currentPage]);
  useEffect(()=>{
    const iv = setInterval(()=>{
      if (orders.some(o=>o.status==="new"||o.status==="placed")) fetchOrders();
    },5000);
    return ()=>clearInterval(iv);
  },[orders,currentPage]);

  function updateOrder(id:string,upd:Partial<Order>){
    setOrders(a=>a.map(o=>o.id===id?{...o,...upd}:o));
  }
  async function completeOrder(id:string){
    await fetch(`/api/orders/${id}`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ status:"completed" })
    });
    updateOrder(id,{status:"completed"});
    fetchOrders();
  }

  async function acceptAndSend(order:Order,minutes:number){
    const dt = new Date(Date.now()+minutes*60000).toISOString();
    // PATCH employee_delivery_time
    const res = await fetch(`/api/orders/${order.id}`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ status:"accepted", employee_delivery_time:dt })
    });
    if (!res.ok) return;
    updateOrder(order.id,{status:"accepted",deliveryTime:dt});
    // sms
    await fetch("/api/twilio/send-accept",{ method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ order_id:order.id, delivery_time:dt })
    });
    // dotykacka
    await fetch("/api/dotykacka/send-order",{ method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ order_id:order.id })
    });
    fetchOrders();
  }

  async function extendTime(order:Order,minutes:number){
    const base = order.deliveryTime && !isNaN(Date.parse(order.deliveryTime))
      ? new Date(order.deliveryTime) : new Date();
    const dt = new Date(base.getTime()+minutes*60000).toISOString();
    const res = await fetch(`/api/orders/${order.id}`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ employee_delivery_time:dt })
    });
    if (!res.ok) return;
    updateOrder(order.id,{deliveryTime:dt});
    await fetch("/api/twilio/send-time-update",{ method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ order_id:order.id, delivery_time:dt })
    });
    fetchOrders();
  }

  const filtered = orders
    .filter(o=>filterStatus==="all"||o.status===filterStatus)
    .filter(o=>filterOption==="all"||o.selected_option===filterOption)
    .sort((a,b)=>(sortOrder==="desc"
      ? new Date(b.created_at).getTime()-new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime()-new Date(b.created_at).getTime()
    ));

  const newList  = filtered.filter(o=>o.status==="new"||o.status==="placed");
  const currList = filtered.filter(o=>o.status==="accepted");
  const histList = filtered.filter(o=>o.status==="cancelled"||o.status==="completed");

  return (
    <div className="min-h-screen p-4 space-y-6 bg-white text-black">
      {/* FILTRY */}
      <div className="flex flex-wrap gap-4 items-center">
        <select
          className="border p-2 rounded"
          value={filterStatus}
          onChange={e=>setFilterStatus(e.target.value as any)}
        >
          <option value="all">Wszystkie statusy</option>
          <option value="new">Nowe</option>
          <option value="placed">Złożone</option>
          <option value="accepted">W trakcie</option>
          <option value="cancelled">Anulowane</option>
          <option value="completed">Zrealizowane</option>
        </select>
        <select
          className="border p-2 rounded"
          value={filterOption}
          onChange={e=>setFilterOption(e.target.value as any)}
        >
          <option value="all">Wszystkie opcje</option>
          <option value="local">Na miejscu</option>
          <option value="takeaway">Na wynos</option>
          <option value="delivery">Dostawa</option>
        </select>
        <button
          className="border p-2 rounded"
          onClick={()=>setSortOrder(o=>o==="desc"?"asc":"desc")}
        >
          {sortOrder==="desc"?"Najnowsze":"Najstarsze"}
        </button>
      </div>

      {/* NOWE */}
      <section>
        <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Nowe zamówienia</h2>
        <ul className="list-none p-0 space-y-4">
          {newList.length===0 && (
            <li><p className="text-center text-gray-600">Brak nowych zamówień.</p></li>
          )}
          {newList.map(o=>(
            <li key={o.id} className={`p-6 rounded-xl shadow-md ${getBorderClass(o.status)}`}>
              <div className="flex items-start justify-between mb-4 border-b pb-2">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">{getOptionLabel(o.selected_option)}</h3>
                  <p className="text-sm">Status: <span className="text-yellow-600">{o.status.toUpperCase()}</span></p>
                  <p className="text-sm">Czas (klient): {o.clientDelivery==="asap"?"Jak najszybciej":new Date(o.clientDelivery!).toLocaleTimeString()}</p>
                </div>
                <div className="text-base text-gray-600 font-bold">
                  {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
              {renderOrderDetails(o,setSelectedProduct)}
              <div className="flex flex-wrap gap-2 mt-4">
                <AcceptButton
                  orderId={o.id}
                  onAccept={minutes=>acceptAndSend(o,minutes)}
                />
                <EditOrderButton
                  orderId={o.id}
                  currentProducts={parseProducts(o.items)}
                  currentSelectedOption={o.selected_option||"local"}
                  onOrderUpdated={()=>fetchOrders()}
                />
                <CancelButton
                  orderId={o.id}
                  onOrderUpdated={()=>fetchOrders()}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* W REALIZACJI */}
      <section>
        <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Zamówienia w realizacji</h2>
        <ul className="list-none p-0 space-y-4">
          {currList.length===0 && (
            <li><p className="text-center text-gray-600">Brak zamówień w realizacji.</p></li>
          )}
          {currList.map(o=>(
            <li key={o.id} className={`p-6 rounded-xl shadow-md ${getBorderClass(o.status)}`}>
              <div className="flex items-start justify-between mb-4 border-b pb-2">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">{getOptionLabel(o.selected_option)}</h3>
                  <p className="text-sm text-green-600 font-semibold">AKCEPTOWANE</p>
                </div>
                <div>
                  {o.deliveryTime==="asap"
                    ? <span className="text-sm font-medium">Jak najszybciej</span>
                    : <CountdownTimer targetTime={o.deliveryTime!} onComplete={()=>completeOrder(o.id)} />
                  }
                </div>
              </div>
              {renderOrderDetails(o,setSelectedProduct)}
              <div className="flex flex-wrap gap-2 mt-4">
                <CancelButton orderId={o.id} onOrderUpdated={()=>fetchOrders()}/>
                { [15,30,45,60].map(m=>(
                    <button
                      key={m}
                      onClick={()=>extendTime(o,m)}
                      className="w-28 h-10 bg-green-600 hover:bg-green-500 text-white rounded-full font-semibold text-sm"
                    >
                      {m>=60?`${m/60} H`:`${m} MIN`}
                    </button>
                  ))
                }
                <EditOrderButton
                  orderId={o.id}
                  currentProducts={parseProducts(o.items)}
                  currentSelectedOption={o.selected_option||"local"}
                  onOrderUpdated={()=>fetchOrders()}
                />
                <button
                  onClick={()=>completeOrder(o.id)}
                  className="w-32 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold text-sm"
                >
                  Zrealizowany
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* HISTORIA */}
      <section>
        <h2 className="text-2xl font-semibold mb-4 border-b border-gray-300 pb-2">Historia</h2>
        <ul className="list-none p-0 space-y-4">
          {histList.length===0 && (
            <li><p className="text-center text-gray-600">Brak historii zamówień.</p></li>
          )}
          {histList.map(o=>(
            <li key={o.id} className={`p-6 rounded-xl shadow-md ${getBorderClass(o.status)}`}>
              <div className="flex items-start justify-between mb-4 border-b pb-2">
                <div>
                  <h3 className="text-xl font-bold">{getOptionLabel(o.selected_option)}</h3>
                  <p className="text-sm">
                    Status: <span className={o.status==="completed"?"text-gray-600":"text-red-600"}>
                      {o.status.toUpperCase()}
                    </span>
                  </p>
                </div>
                <div className="text-base text-gray-600 font-bold">
                  {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
              {renderOrderDetails(o,setSelectedProduct)}
              {o.status==="cancelled" && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={async()=>{
                      await fetch(`/api/orders/${o.id}`,{
                        method:"PATCH",
                        headers:{"Content-Type":"application/json"},
                        body:JSON.stringify({ status:"new" })
                      });
                      updateOrder(o.id,{status:"new"});
                      fetchOrders();
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm"
                  >
                    Przywróć
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* MODALE */}
      {selectedProduct && (
        <ProductDetailsModal product={selectedProduct} onClose={()=>setSelectedProduct(null)} />
      )}

      {showAddProductModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-lg">
            <h4 className="text-2xl font-bold mb-4">Wybierz produkt</h4>
            <ul className="space-y-2 max-h-64 overflow-auto">
              {productsData.flatMap(cat =>
                (cat.items||[]).concat(...(cat.subcategories||[]).flatMap(s=>s.items||[]))
              ).map((p:any)=>(
                <li key={p.name}>
                  <button
                    onClick={()=>{/* PATCH do API… */ setShowAddProductModal(false); fetchOrders();}}
                    className="block w-full text-left px-3 py-2 border-b hover:bg-gray-100 rounded"
                  >
                    {p.name} — {p.price} zł
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={()=>setShowAddProductModal(false)} className="mt-4 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-full w-full">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* PAGINACJA */}
      <div className="flex justify-center items-center gap-4 mt-6">
        <button
          onClick={()=>setCurrentPage(p=>Math.max(p-1,1))}
          disabled={currentPage===1}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
        >Poprzednia</button>
        <span className="text-gray-600">Strona {currentPage} z {Math.ceil(totalCount/ordersPerPage)}</span>
        <button
          onClick={()=>setCurrentPage(p=>p<Math.ceil(totalCount/ordersPerPage)?p+1:p)}
          disabled={currentPage>=Math.ceil(totalCount/ordersPerPage)}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
        >Następna</button>
      </div>
    </div>
  );
}
