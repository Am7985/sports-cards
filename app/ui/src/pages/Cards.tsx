// app/ui/src/pages/Cards.tsx
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
  const [q, setQ] = useState("");
  // keep the latest thumbnail URL per card (purely for UI preview)
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  async function load() {
    const { data } = await api.get<Card[]>("/v1/cards", { params: q ? { q } : {} });
    setCards(data);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [q]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/v1/cards", {
      year: form.year ? Number(form.year) : undefined,
      brand: form.brand, set_name: form.set_name, card_no: form.card_no,
      player: form.player, sport: form.sport,
    });
    setForm({});
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/v1/cards/${id}`);
    await load();
  }

  // 👇 PUT THIS "HELPER" INSIDE THE COMPONENT (above return)
  // It uploads a file to /v1/media/upload and stores a preview URL.
  async function upload(card_uuid: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("card_uuid", card_uuid);

    const { data } = await api.post("/v1/media/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    // backend returns { ok, media_uuid, url: "/media/<filename>" }
    const full = `${import.meta.env.VITE_API_BASE_URL}${data.url}`;
    setThumbs((t) => ({ ...t, [card_uuid]: full }));
  }

  async function load() {
  const { data } = await api.get<Card[]>("/v1/cards", { params: q ? { q } : {} });
  setCards(data);

  const pairs = await Promise.all(
    data.map(async (c) => {
      try {
        const r = await api.get<{ url: string | null; thumb_url: string | null }>("/v1/media/latest", {
          params: { card_uuid: c.card_uuid },
        });
        const full = (u: string | null) => (u ? `${import.meta.env.VITE_API_BASE_URL}${u}` : "");
        return [c.card_uuid, full(r.data.thumb_url)] as const;
      } catch {
        return [c.card_uuid, ""] as const;
      }
    })
  );
  setThumbs(Object.fromEntries(pairs));
}


  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Cards</h1>

      <div className="flex items-center gap-3">
        <input
          className="border p-2 rounded w-full md:w-80"
          placeholder="Search player / brand / set…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <a
          className="inline-block bg-gray-700 text-white rounded px-3 py-2"
          href={`${import.meta.env.VITE_API_BASE_URL}/v1/export/cards.csv`}
          target="_blank"
          rel="noreferrer"
        >
          <label className="inline-block bg-gray-700 text-white rounded px-3 py-2 cursor-pointer">
            Import CSV
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={async (e) => {
                const input = e.currentTarget;
                const f = input.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.append("file", f);
                try {
                  const r = await api.post("/v1/import/cards.csv", fd, { headers: { "Content-Type": "multipart/form-data" } });
                  alert(`Imported: ${r.data.created} (errors: ${r.data.errors})`);
                  await load();
                } finally {
                  input.value = "";
                }
              }}
            />
          </label>
          Export CSV
        </a>
      </div>

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
            <th>Media</th>
            <th></th>
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
              <td className="py-2">
                {thumbs[c.card_uuid] && (
                  <img
                    src={thumbs[c.card_uuid]}
                    alt=""
                    className="h-12 w-12 object-cover rounded inline-block mr-2 align-middle"
                  />
                )}
                <label className="text-blue-600 hover:underline cursor-pointer align-middle">
                  Upload
                  <input
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) await upload(c.card_uuid, f);
                      // allow re-selecting same file
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </td>
              <td>
                <button onClick={() => remove(c.card_uuid)} className="text-red-500 hover:underline">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
