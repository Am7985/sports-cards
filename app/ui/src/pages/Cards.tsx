// src/pages/Cards.tsx
import { useEffect, useState } from "react";
import api from "../lib/api";

type Card = {
  card_uuid: string;
  year?: number;
  brand?: string;
  set_name?: string;
  card_no?: string;
  player?: string;
  sport?: string;
  updated_at: string;
};

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [form, setForm] = useState<Partial<Card>>({});

  const load = async () => {
    const { data } = await api.get<Card[]>("/v1/cards");
    setCards(data);
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/v1/cards", {
      year: form.year ? Number(form.year) : undefined,
      brand: form.brand, set_name: form.set_name, card_no: form.card_no,
      player: form.player, sport: form.sport,
    });
    setForm({});
    await load();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Cards</h1>

      <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
        <input className="border p-2 rounded" placeholder="Year"
          value={form.year ?? ""} onChange={e=>setForm(f=>({...f, year:e.target.value as any}))}/>
        <input className="border p-2 rounded" placeholder="Brand"
          value={form.brand ?? ""} onChange={e=>setForm(f=>({...f, brand:e.target.value}))}/>
        <input className="border p-2 rounded" placeholder="Set"
          value={form.set_name ?? ""} onChange={e=>setForm(f=>({...f, set_name:e.target.value}))}/>
        <input className="border p-2 rounded" placeholder="No."
          value={form.card_no ?? ""} onChange={e=>setForm(f=>({...f, card_no:e.target.value}))}/>
        <input className="border p-2 rounded" placeholder="Player"
          value={form.player ?? ""} onChange={e=>setForm(f=>({...f, player:e.target.value}))}/>
        <input className="border p-2 rounded" placeholder="Sport"
          value={form.sport ?? ""} onChange={e=>setForm(f=>({...f, sport:e.target.value}))}/>
        <button className="bg-blue-600 text-white px-4 py-2 rounded col-span-2 md:col-span-1">Add</button>
      </form>

      <table className="w-full text-sm">
        <thead className="text-left">
          <tr className="border-b">
            <th className="py-2">Year</th>
            <th>Brand</th>
            <th>Set</th>
            <th>No.</th>
            <th>Player</th>
            <th>Sport</th>
          </tr>
        </thead>
        <tbody>
          {cards.map(c => (
            <tr key={c.card_uuid} className="border-b hover:bg-gray-50">
              <td className="py-2">{c.year ?? ""}</td>
              <td>{c.brand ?? ""}</td>
              <td>{c.set_name ?? ""}</td>
              <td>{c.card_no ?? ""}</td>
              <td>{c.player ?? ""}</td>
              <td>{c.sport ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
