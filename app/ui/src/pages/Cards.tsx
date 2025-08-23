// app/ui/src/pages/Cards.tsx
import { useEffect, useMemo, useRef, useState } from "react";
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
  wishlisted?: boolean;
};

type Side = "front" | "back";
type Pair = { front?: { thumb: string; full: string }; back?: { thumb: string; full: string } };
type MediaMap = Record<string, Pair>;

// Browse response fallbacks
type SportsResp = { sports: string[] } | string[];
type YearsResp = { years: number[] } | number[];
type ProductsResp =
  | { products: (string | { label: string })[] }
  | (string | { label: string })[];

export default function CardsPage() {
  // -------- query & paging ----------
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // committed query vs. input box text
  const [q, setQ] = useState("");
  const [qText, setQText] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // -------- form & ui ----------
  const [form, setForm] = useState<Partial<Card>>({});
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<MediaMap>({});
  const [preview, setPreview] = useState<{ url: string; alt?: string } | null>(null);

  // -------- browse state ----------
  const [sports, setSports] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [selSport, setSelSport] = useState<string | null>(null);
  const [selYear, setSelYear] = useState<number | null>(null);
  const [selProduct, setSelProduct] = useState<string | null>(null);

  // -------- data load ----------
  async function load() {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (q) params.q = q;

      const r = await api.get("/v1/cards", { params });

      // Accept both array and {items,total}
      const items: Card[] = Array.isArray(r.data) ? r.data : r.data.items ?? [];
      const totalCount: number | null = Array.isArray(r.data)
        ? null
        : typeof r.data.total === "number"
        ? r.data.total
        : null;

      setCards(items);
      setTotal(totalCount);

      // Load media pairs per row
      const pairs = await Promise.all(
        items.map(async (c) => {
          try {
            const resp = await api.get<{ front: any; back: any }>("/v1/media/pair", {
              params: { card_uuid: c.card_uuid },
            });
            const toAbs = (u?: string | null) => (u ? `${import.meta.env.VITE_API_BASE_URL}${u}` : "");
            const pair: Pair = {};
            if (resp.data.front) pair.front = { thumb: toAbs(resp.data.front.thumb_url), full: toAbs(resp.data.front.url) };
            if (resp.data.back) pair.back = { thumb: toAbs(resp.data.back.thumb_url), full: toAbs(resp.data.back.url) };
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

  // initial load
  useEffect(() => { load(); }, []);
  // reload when committed query or page changes
  useEffect(() => { load(); }, [q, page]);

  // -------- browse initial load ----------
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get<SportsResp>("/v1/cards/browse/sports");
        const list = Array.isArray(r.data) ? r.data : (r.data as any).sports ?? [];
        setSports(list);
      } catch { /* ignore */ }
    })();
  }, []);

  // if sport changes, fetch years
  useEffect(() => {
    if (!selSport) { setYears([]); setProducts([]); setSelYear(null); setSelProduct(null); return; }
    (async () => {
      try {
        const r = await api.get<YearsResp>("/v1/cards/browse/years", { params: { sport: selSport } });
        const list = Array.isArray(r.data) ? r.data : (r.data as any).years ?? [];
        setYears(list.sort((a, b) => b - a)); // newest first
      } catch { setYears([]); }
      setProducts([]); setSelYear(null); setSelProduct(null);
    })();
  }, [selSport]);

  // if year changes, fetch products
  useEffect(() => {
    if (!selSport || !selYear) { setProducts([]); setSelProduct(null); return; }
    (async () => {
      try {
        const r = await api.get<ProductsResp>("/v1/cards/browse/products", { params: { sport: selSport, year: selYear } });
        const raw = Array.isArray(r.data) ? r.data : (r.data as any).products ?? [];
        const normalized = raw.map((p: any) => (typeof p === "string" ? p : p?.label ?? "")).filter(Boolean);
        setProducts(normalized);
      } catch { setProducts([]); }
      setSelProduct(null);
    })();
  }, [selSport, selYear]);

  // when product is picked, set q & qText and jump to page 1
  useEffect(() => {
    if (!selProduct) return;
    setQText(selProduct);
    setQ(selProduct);
    setPage(1);
    // keep search focused
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [selProduct]);

  // -------- CRUD ----------
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

  async function toggleWishlist(card_uuid: string, current?: boolean) {
    await api.post(`/v1/cards/${card_uuid}/wishlist`, { wishlisted: !current });
    setCards(prev => prev.map(c => c.card_uuid === card_uuid ? { ...c, wishlisted: !current } : c));
  }

  // -------- small UI bits ----------
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

  // fixed focus SearchInput
  function SearchInput() {
    const submit = () => {
      setQ(qText.trim());
      setPage(1);
      requestAnimationFrame(() => searchRef.current?.focus());
    };
    const clear = () => {
      setQText("");
      setQ("");
      setPage(1);
      // also clear selected product breadcrumb, but keep sport/year selection
      setSelProduct(null);
      requestAnimationFrame(() => searchRef.current?.focus());
    };

    return (
      <div className="relative w-full md:w-[28rem]">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400">🔎</span>
        <input
          ref={searchRef}
          value={qText}
          onChange={(e) => {
            setQText(e.target.value);
            requestAnimationFrame(() => searchRef.current?.focus());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
          }}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 py-2 pl-7 pr-7 text-sm
                     placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
          placeholder="Search player / brand / set…"
          type="text"
        />
        {qText && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center
                       text-neutral-300 hover:text-white"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  function Heart({ on, onClick }: { on: boolean; onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="inline-flex items-center justify-center w-6 h-6"
        title={on ? "Remove from wishlist" : "Add to wishlist"}
      >
        <svg viewBox="0 0 24 24" className={`w-5 h-5 ${on ? "fill-pink-600" : "fill-transparent"} stroke-pink-600`}>
          <path strokeWidth="1.6" d="M12 21s-5.052-3.142-7.5-5.59C2.5 13.41 2 11.7 2 10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 1.7-.5 3.41-2.5 5.41C17.052 17.858 12 21 12 21z"/>
        </svg>
      </button>
    );
  }

  function Thumb({ url, full, side, card }: { url: string; full: string; side: Side; card: Card }) {
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
        <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] leading-none text-neutral-200">
          {side === "front" ? "F" : "B"}
        </span>
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
            try { await upload(card.card_uuid, f, side); }
            finally { e.currentTarget.value = ""; }
          }}
        />
      </div>
    );
  }

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

  const totalPages = useMemo(() => {
    if (total == null) return null; // unknown
    return Math.max(1, Math.ceil(total / pageSize));
  }, [total]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-0 pb-6 space-y-4">
      {/* Header / toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Card Database</h1>
          <p className="text-sm text-neutral-400">
            {total != null ? `${total} total • ` : ""}{cards.length} shown
          </p>
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
                  setPage(1);
                  await load();
                } finally { input.value = ""; }
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

      {/* Browse bar */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-400 mr-1">Sport:</span>
          {sports.map((s) => (
            <button
              key={s}
              onClick={() => setSelSport(s === selSport ? null : s)}
              className={`rounded-md border px-3 py-1 text-sm ${
                s === selSport ? "border-blue-500 bg-blue-600/20" : "border-neutral-700 bg-neutral-800 hover:bg-neutral-750"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {selSport && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-400 mr-1">Year:</span>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setSelYear(y === selYear ? null : y)}
                className={`rounded-md border px-3 py-1 text-sm ${
                  y === selYear ? "border-blue-500 bg-blue-600/20" : "border-neutral-700 bg-neutral-800 hover:bg-neutral-750"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        {selSport && selYear && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-400 mr-1">Product:</span>
            {products.map((p) => (
              <button
                key={p}
                onClick={() => setSelProduct(p)}
                className={`rounded-md border px-3 py-1 text-sm ${
                  p === selProduct ? "border-blue-500 bg-blue-600/20" : "border-neutral-700 bg-neutral-800 hover:bg-neutral-750"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {(selSport || selYear || selProduct) && (
          <div className="text-xs text-neutral-400">
            Selected:&nbsp;
            <span className="text-neutral-200">{selSport ?? "—"}</span>
            {selYear ? <> &gt; <span className="text-neutral-200">{selYear}</span></> : null}
            {selProduct ? <> &gt; <span className="text-neutral-200">{selProduct}</span></> : null}
          </div>
        )}
      </div>

      {/* Quick-add form */}
      <form
        onSubmit={create}
        className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-2 md:grid-cols-6"
      >
        <input className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none" placeholder="Year"
               value={form.year ?? ""} onChange={(e)=>setForm(f=>({...f, year:e.target.value as any}))}/>
        <input className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none" placeholder="Brand"
               value={form.brand ?? ""} onChange={(e)=>setForm(f=>({...f, brand:e.target.value}))}/>
        <input className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none" placeholder="Set"
               value={form.set_name ?? ""} onChange={(e)=>setForm(f=>({...f, set_name:e.target.value}))}/>
        <input className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none" placeholder="No."
               value={form.card_no ?? ""} onChange={(e)=>setForm(f=>({...f, card_no:e.target.value}))}/>
        <input className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none" placeholder="Player"
               value={form.player ?? ""} onChange={(e)=>setForm(f=>({...f, player:e.target.value}))}/>
        <div className="flex items-center gap-2">
          <input className="w-full rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none" placeholder="Sport"
                 value={form.sport ?? ""} onChange={(e)=>setForm(f=>({...f, sport:e.target.value}))}/>
          <ToolbarButton type="submit" className="bg-blue-600 border-blue-600 hover:bg-blue-500">Add</ToolbarButton>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-900/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/70">
            <tr className="[&>th]:py-2 [&>th]:px-3 [&>th]:text-left [&>th]:font-medium [&>th]:text-neutral-300">
              <th className="w-8"></th>
              <th>Year</th>
              <th>Brand</th>
              <th>Set</th>
              <th>No.</th>
              <th>Player</th>
              <th>Sport</th>
              <th>Media (Front / Back)</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-t [&>tr]:border-neutral-800">
            {cards.map((c) => {
              const pair = media[c.card_uuid] || {};
              return (
                <tr key={c.card_uuid} className="hover:bg-neutral-900/60">
                  <td className="px-3 py-2">
                    <Heart on={!!c.wishlisted} onClick={() => toggleWishlist(c.card_uuid, c.wishlisted)} />
                  </td>
                  <td className="px-3 py-2">{c.year ?? ""}</td>
                  <td className="px-3 py-2">{c.brand ?? ""}</td>
                  <td className="px-3 py-2">{c.set_name ?? ""}</td>
                  <td className="px-3 py-2">{c.card_no ?? ""}</td>
                  <td className="px-3 py-2">{c.player ?? ""}</td>
                  <td className="px-3 py-2">{c.sport ?? ""}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      {pair.front?.thumb ? (
                        <Thumb url={pair.front.thumb} full={pair.front.full} side="front" card={c} />
                      ) : (
                        <EmptySlot cardId={c.card_uuid} side="front" />
                      )}
                      {pair.back?.thumb ? (
                        <Thumb url={pair.back.thumb} full={pair.back.full} side="back" card={c} />
                      ) : (
                        <EmptySlot cardId={c.card_uuid} side="back" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => remove(c.card_uuid)} className="text-red-400 hover:text-red-300">
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* paging */}
        <div className="flex items-center justify-between border-t border-neutral-800 p-3 text-sm">
          <div className="text-neutral-400">
            Page {page}{totalPages ? ` of ${totalPages}` : ""}{total != null ? ` • ${total} total` : ""}
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>
            <button
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 disabled:opacity-50"
              onClick={() => setPage((p) => (totalPages ? Math.min(totalPages, p + 1) : p + 1))}
              disabled={totalPages ? page >= totalPages : false}
            >
              Next
            </button>
          </div>
        </div>

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
