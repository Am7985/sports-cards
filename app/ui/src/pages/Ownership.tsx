import { useEffect, useState } from "react";
import api from "../lib/api";

type Card = { card_uuid: string; player?: string; year?: number; brand?: string; set_name?: string; card_no?: string; };
type Ownership = {
  ownership_uuid: string; card_uuid: string; condition_type?: string; grade_scale?: string; grade_value?: string;
  cert_no?: string; price_paid?: number; quantity: number; status?: string; created_at: string;
};

export default function OwnershipPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [items, setItems] = useState<Ownership[]>([]);
  const [form, setForm] = useState<Partial<Ownership>>({ quantity: 1, condition_type: "RAW", grade_scale: "RAW" });
  const [filterCard, setFilterCard] = useState<string>("");

  const load = async () => {
    const cs = (await api.get<Card[]>("/v1/cards", { params: { limit: 500 } })).data;
    setCards(cs);
    const os = (await api.get<Ownership[]>("/v1/ownership", { params: filterCard ? { card_uuid: filterCard } : {} })).data;
    setItems(os);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { load(); /* re-run when filter changes */ }, [filterCard]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/v1/ownership", {
      card_uuid: form.card_uuid || filterCard,
      condition_type: form.condition_type,
      grade_scale: form.grade_scale,
      grade_value: form.grade_value,
      cert_no: form.cert_no,
      price_paid: form.price_paid ? Number(form.price_paid) : undefined,
      quantity: form.quantity ? Number(form.quantity) : 1,
      status: form.status || "OWNED",
    });
    setForm({ quantity: 1, condition_type: "RAW", grade_scale: "RAW" });
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/v1/ownership/${id}`);
    await load();
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Ownership</h1>

      <div className="flex gap-3 items-center">
        <select className="border p-2 rounded" value={filterCard} onChange={(e)=>setFilterCard(e.target.value)}>
          <option value="">All cards</option>
          {cards.map(c => (
            <option key={c.card_uuid} value={c.card_uuid}>
              {c.year ?? ""} {c.brand ?? ""} {c.set_name ?? ""} #{c.card_no ?? ""} – {c.player ?? ""}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-8 gap-3 items-end">
        <select className="border p-2 rounded col-span-2" value={form.card_uuid || filterCard}
                onChange={e=>setForm(f=>({...f, card_uuid: e.target.value}))}>
          <option value="">Pick card…</option>
          {cards.map(c => (
            <option key={c.card_uuid} value={c.card_uuid}>
              {c.year ?? ""} {c.brand ?? ""} {c.set_name ?? ""} #{c.card_no ?? ""} – {c.player ?? ""}
            </option>
          ))}
        </select>
        <select className="border p-2 rounded" value={form.condition_type ?? "RAW"}
                onChange={e=>setForm(f=>({...f, condition_type: e.target.value}))}>
          <option>RAW</option><option>GRADED</option>
        </select>
        <select className="border p-2 rounded" value={form.grade_scale ?? "RAW"}
                onChange={e=>setForm(f=>({...f, grade_scale: e.target.value}))}>
          <option>RAW</option><option>PSA</option><option>BGS</option><option>SGC</option>
        </select>
        <input className="border p-2 rounded" placeholder="Grade" value={form.grade_value ?? ""}
               onChange={e=>setForm(f=>({...f, grade_value: e.target.value}))}/>
        <input className="border p-2 rounded" placeholder="Cert #" value={form.cert_no ?? ""}
               onChange={e=>setForm(f=>({...f, cert_no: e.target.value}))}/>
        <input className="border p-2 rounded" placeholder="Price Paid" value={form.price_paid ?? ""}
               onChange={e=>setForm(f=>({...f, price_paid: e.target.value as any}))}/>
        <input className="border p-2 rounded" placeholder="Qty" value={form.quantity ?? 1}
               onChange={e=>setForm(f=>({...f, quantity: Number(e.target.value)||1}))}/>
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
      </form>

      <table className="w-full text-sm">
        <thead><tr className="border-b">
          <th className="py-2">Card</th><th>Type</th><th>Scale</th><th>Grade</th>
          <th>Cert</th><th>Qty</th><th>Price</th><th></th>
        </tr></thead>
        <tbody>
          {items.map(o => {
            const c = cards.find(x => x.card_uuid === o.card_uuid);
            return (
              <tr key={o.ownership_uuid} className="border-b">
                <td className="py-2">{c ? `${c.year ?? ""} ${c.brand ?? ""} ${c.set_name ?? ""} #${c.card_no ?? ""} – ${c.player ?? ""}` : o.card_uuid}</td>
                <td>{o.condition_type ?? ""}</td>
                <td>{o.grade_scale ?? ""}</td>
                <td>{o.grade_value ?? ""}</td>
                <td>{o.cert_no ?? ""}</td>
                <td>{o.quantity}</td>
                <td>{o.price_paid ?? ""}</td>
                <td><button className="text-red-500 hover:underline" onClick={()=>remove(o.ownership_uuid)}>Delete</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
