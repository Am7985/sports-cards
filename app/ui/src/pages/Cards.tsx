// app/ui/src/pages/Cards.tsx
import { useEffect, useRef, useState } from "react";
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
type Pair = { front?: { thumb: string; full: string }; back?: { thumb: string; full: string } };
type MediaMap = Record<string, Pair>;

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [form, setForm] = useState<Partial<Card>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<MediaMap>({});
  const [preview, setPreview] = useState<{ url: string; alt?: string } | null>(null);

  // ---------- data ----------
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
            const toAbs = (u?: string | null) => (u ? `${import.meta.env.VITE_API_BASE_URL}${u}` : "");
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
    if (!confirm("Delete this card?")) return;
    await api.delete(`/v1/cards/${id}`);
    await load();
  }

  async function upload(card_uuid: string, file: File, side: Side) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("card_uuid", card_uuid);
    fd.append("kind", side);
    const { data } = await api.post("/v1/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
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

  // ---------- small UI helpers ----------
  function ToolbarButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const { className = "", ...rest } = props;
    return (
      <button
        {...rest}
        className={
          "inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-800 " +
          "px-3 py-2 text-sm hover:bg-neutral-750 active:scale-[0.99] " + className
        }
      />
    );
  }

  function SearchInput() {
    return (
      <div className="relative w-full md:w-80">
        <span className="pointer-events-none absolute left-2 top-2.5 text-neutral-400">🔎</span>
        <input
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 py-2 pl-7 pr-2 text-sm
                     placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
          placeholder="Search player / brand / set…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
    );
  }

  // Thumbnail with badges + replace chip (shows on hover only)
  function Thumb({
    url, full, side, card, onReplace,
  }: { url: string; full: string; side: Side; card: Card; onReplace: () => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
      <div className="relative group inline-block">
        <img
          src={url}
          alt=""
          className="h-12 w-12 rounded-md object-cover shadow ring-1 ring-neutral-700 group-hover:ring-neutral-500 transition"
          onClick={() => setPreview({ url: full || url, alt: `${card.year ?? ""} ${card.player ?? ""} (${side})` })}
          title={`${side[0].toUpperCase() + side.slice(1)} – click to view`}
        />
        {/* F/B badge */}
        <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] leading-none text-neutral-200">
          {side === "front" ? "F" : "B"}
        </span>
        {/* replace chip (only visible on hover) */}
        <span
          role="button"
          aria-label={`Replace ${side}`}
          className="absolute bottom-1 right-1 z-10 hidden h-[14px] w-[14px] cursor-pointer select-none
                     items-center justify-center rounded-sm bg-black/70 text-[11px] leading-none text-red-500
                     group-hover:flex"
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          title={`Replace ${side}`}
        >
          ×
        </span>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            if (!f) return;
            try { await onReplace ? onReplace() : null; await upload(card.card_uuid, f, side); }
            finally { e.currentTarget.value = ""; }
          }}
        />
      </div>
    );
  }

  // Empty dashed slot with big F/B + click to upload
  function EmptySlot({ cardId, side }: { cardId: string; side: Side }) {
    const inputId = `${cardId}-${side}-empty`;
    return (
      <label
        htmlFor={inputId}
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-md border-2 border-dashed
                   border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
        title={`Upload ${side}`}
      >
        <span className="text-xs">
          {side === "front" ? "F" : "B"} <span className="text-neutral-400">+</span>
        </span>
        <input
          id={inputId}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            if (!f) return;
            try { await upload(cardId, f, side); }
            finally { e.currentTarget.value = ""; }
          }}
        />
      </label>
    );
  }

  // ---------- render ----------
  return (
    <div className="mx-auto max-w-6xl px-4 pt-0 pb-8 space-y-4">
      {/* Header / toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Cards</h1>
          <p className="text-sm text-neutral-400">{cards.length} card{cards.length === 1 ? "" : "s"}</p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <SearchInput />

          {/* Import CSV */}
          <label className="inline-flex cursor-pointer items-center rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-750">
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
            className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-750"
            href={`${import.meta.env.VITE_API_BASE_URL}/v1/export/cards.csv`}
            target="_blank"
            rel="noreferrer"
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* Quick-add form */}
      <form onSubmit={create} className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-2 md:grid-cols-6">
        <input className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none" placeholder="Year"  value={form.year ?? ""}  onChange={(e)=>setForm(f=>({...f, year:e.target.value as any}))}/>
        <input className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none" placeholder="Brand" value={form.brand ?? ""} onChange={(e)=>setForm(f=>({...f, brand:e.target.value}))}/>
        <input className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none" placeholder="Set"   value={form.set_name ?? ""} onChange={(e)=>setForm(f=>({...f, set_name:e.target.value}))}/>
        <input className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none" placeholder="No."   value={form.card_no ?? ""} onChange={(e)=>setForm(f=>({...f, card_no:e.target.value}))}/>
        <input className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none" placeholder="Player" value={form.player ?? ""} onChange={(e)=>setForm(f=>({...f, player:e.target.value}))}/>
        <div className="flex items-center gap-2">
          <input className="w-full rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none" placeholder="Sport" value={form.sport ?? ""} onChange={(e)=>setForm(f=>({...f, sport:e.target.value}))}/>
          <ToolbarButton type="submit" className="bg-blue-600 border-blue-600 hover:bg-blue-500">Add</ToolbarButton>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-900/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/70">
            <tr className="[&>th]:py-2 [&>th]:px-3 [&>th]:text-left [&>th]:font-medium [&>th]:text-neutral-300">
              <th>Year</th><th>Brand</th><th>Set</th><th>No.</th><th>Player</th><th>Sport</th><th>Media (Front / Back)</th><th></th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-t [&>tr]:border-neutral-800">
            {cards.map((c) => {
              const pair = media[c.card_uuid] || {};
              return (
                <tr key={c.card_uuid} className="hover:bg-neutral-900/60">
                  <td className="px-3 py-2">{c.year ?? ""}</td>
                  <td className="px-3 py-2">{c.brand ?? ""}</td>
                  <td className="px-3 py-2">{c.set_name ?? ""}</td>
                  <td className="px-3 py-2">{c.card_no ?? ""}</td>
                  <td className="px-3 py-2">{c.player ?? ""}</td>
                  <td className="px-3 py-2">{c.sport ?? ""}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      {/* FRONT */}
                      {pair.front?.thumb ? (
                        <Thumb url={pair.front.thumb} full={pair.front.full} side="front" card={c} onReplace={() => {}} />
                      ) : (
                        <EmptySlot cardId={c.card_uuid} side="front" />
                      )}

                      {/* BACK */}
                      {pair.back?.thumb ? (
                        <Thumb url={pair.back.thumb} full={pair.back.full} side="back" card={c} onReplace={() => {}} />
                      ) : (
                        <EmptySlot cardId={c.card_uuid} side="back" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => remove(c.card_uuid)} className="text-red-400 hover:text-red-300">Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && <div className="border-t border-neutral-800 p-3 text-sm text-neutral-400">Loading…</div>}
        {!loading && cards.length === 0 && (
          <div className="border-t border-neutral-800 p-6 text-center text-sm text-neutral-400">No cards yet.</div>
        )}
      </div>

      {/* Lightbox */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={preview.url}
            alt={preview.alt || ""}
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-lg ring-1 ring-neutral-700"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
