// app/ui/src/pages/Cards.tsx
import { useEffect, useState, useRef } from "react";
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

type Side = "front" | "back";
type Pair = {
  front?: { thumb: string; full: string };
  back?: { thumb: string; full: string };
};
type MediaMap = Record<string, Pair>;

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [form, setForm] = useState<Partial<Card>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [media, setMedia] = useState<MediaMap>({});
  const [preview, setPreview] = useState<{ url: string; alt?: string } | null>(null);

  // Close preview on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPreview(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<Card[]>("/v1/cards", { params: q ? { q } : {} });
      setCards(data);

      const pairs = await Promise.all(
        data.map(async (c) => {
          try {
            const r = await api.get<{ front: any; back: any }>("/v1/media/pair", {
              params: { card_uuid: c.card_uuid },
            });
            const toAbs = (u?: string | null) =>
              u ? `${import.meta.env.VITE_API_BASE_URL}${u}` : "";
            const pair: Pair = {};
            if (r.data.front) pair.front = { thumb: toAbs(r.data.front.thumb_url), full: toAbs(r.data.front.url) };
            if (r.data.back)  pair.back  = { thumb: toAbs(r.data.back.thumb_url),  full: toAbs(r.data.back.url)  };
            return [c.card_uuid, pair] as const;
          } catch {
            return [c.card_uuid, {} as Pair] as const;
          }
        })
      );
      setMedia(Object.fromEntries(pairs));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q]);

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

  async function upload(card_uuid: string, file: File, side: Side) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("card_uuid", card_uuid);
    fd.append("kind", side);
    const { data } = await api.post("/v1/media/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const toAbs = (u?: string | null) => (u ? `${import.meta.env.VITE_API_BASE_URL}${u}` : "");
    setMedia((m) => {
      const prev = m[card_uuid] || {};
      const next = { ...prev };
      const thumb = toAbs(data.thumb_url) || toAbs(data.url);
      const full  = toAbs(data.url);
      next[side] = { thumb, full };
      return { ...m, [card_uuid]: next };
    });
  }

  /** Small red "F"/"B" button for empty slots */
  function FBUpload({
    cardId,
    side,
    text = side === "front" ? "F" : "B",
    className = "",
  }: { cardId: string; side: Side; text?: string; className?: string }) {
    const inputId = `${cardId}-${side}-file-new`;
    return (
      <label
        htmlFor={inputId}
        className={`inline-flex items-center justify-center h-8 w-8 border border-red-500 text-red-500 rounded hover:bg-red-50 cursor-pointer ${className}`}
        title={`Upload ${side}`}
      >
        {text}
        <input
          id={inputId}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const input = e.currentTarget;
            const f = input.files?.[0];
            if (!f) return;
            try { await upload(cardId, f, side); } finally { input.value = ""; }
          }}
        />
      </label>
    );
  }

  /** Small overlay “×” on thumbnail that opens file picker to REPLACE that side */
  function ReplaceOverlay({ cardId, side }: { cardId: string; side: Side }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        role="button"
        aria-label={`Replace ${side}`}
        title={`Replace ${side}`}
        className="absolute bottom-0.5 right-0.5
                  inline-flex items-center justify-center
                  h-[5px] w-[5px] min-h-0 min-w-0 p-0 m-0
                  bg-black/50 hover:bg-black/60
                  text-red-500 text-[4px] leading-[0]
                  rounded-none cursor-pointer select-none z-10"
        onClick={(e) => {
          e.stopPropagation();
          ref.current?.click();
        }}
        style={{ height: '5px', width: 'px' }} // Fallback to enforce size
      >
        ×
      </button>
      <input
        ref={ref}
        type="file"
        className="hidden"
        onChange={async (e) => {
          const input = e.currentTarget;
          const f = input.files?.[0];
          if (!f) return;
          try {
            await upload(cardId, f, side);
          } finally {
            input.value = "";
          }
        }}
      />
    </>
  );
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

        {/* Import CSV */}
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
                const r = await api.post("/v1/import/cards.csv", fd, {
                  headers: { "Content-Type": "multipart/form-data" },
                });
                alert(`Imported: ${r.data.created} (errors: ${r.data.errors})`);
                await load();
              } finally {
                input.value = "";
              }
            }}
          />
        </label>

        {/* Export CSV */}
        <a
          className="inline-block bg-gray-700 text-white rounded px-3 py-2"
          href={`${import.meta.env.VITE_API_BASE_URL}/v1/export/cards.csv`}
          target="_blank"
          rel="noreferrer"
        >
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
            <th>Media (Front / Back)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cards.map((c) => {
            const pair = media[c.card_uuid] || {};
            return (
              <tr key={c.card_uuid} className="border-b hover:bg-gray-50">
                <td className="py-2">{c.year ?? ""}</td>
                <td>{c.brand ?? ""}</td>
                <td>{c.set_name ?? ""}</td>
                <td>{c.card_no ?? ""}</td>
                <td>{c.player ?? ""}</td>
                <td>{c.sport ?? ""}</td>

                <td className="py-2">
                  <div className="flex items-center gap-4">
                    {/* FRONT slot */}
                    <div className="flex items-center gap-2">
                      {pair.front?.thumb ? (
                        <div className="relative inline-block">
                          <img
                            src={pair.front.thumb}
                            alt=""
                            title="Front – click to view"
                            className="h-12 w-12 object-cover rounded cursor-zoom-in"
                            onClick={() =>
                              setPreview({
                                url: pair.front!.full || pair.front!.thumb,
                                alt: `${c.year ?? ""} ${c.player ?? ""} (Front)`,
                              })
                            }
                          />
                          <ReplaceOverlay cardId={c.card_uuid} side="front" />
                        </div>
                      ) : (
                        <FBUpload cardId={c.card_uuid} side="front" />
                      )}
                    </div>

                    {/* BACK slot */}
                    <div className="flex items-center gap-2">
                      {pair.back?.thumb ? (
                        <div className="relative inline-block">
                          <img
                            src={pair.back.thumb}
                            alt=""
                            title="Back – click to view"
                            className="h-12 w-12 object-cover rounded cursor-zoom-in"
                            onClick={() =>
                              setPreview({
                                url: pair.back!.full || pair.back!.thumb,
                                alt: `${c.year ?? ""} ${c.player ?? ""} (Back)`,
                              })
                            }
                          />
                          <ReplaceOverlay cardId={c.card_uuid} side="back" />
                        </div>
                      ) : (
                        <FBUpload cardId={c.card_uuid} side="back" />
                      )}
                    </div>
                  </div>
                </td>

                <td>
                  <button onClick={() => remove(c.card_uuid)} className="text-red-500 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {loading && <div className="text-sm text-gray-500">Loading…</div>}

      {/* Lightbox */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <img
            src={preview.url}
            alt={preview.alt || ""}
            className="max-h-[90vh] max-w-[90vw] rounded shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
