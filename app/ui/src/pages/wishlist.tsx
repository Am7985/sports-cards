// app/ui/src/pages/Wishlist.tsx
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
  wishlisted?: boolean;
};

export default function WishlistPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<Card[]>("/v1/cards", { params: { wishlisted: true, page_size: 500 } });
      setCards(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleWishlist(card_uuid: string, current?: boolean) {
    await api.post(`/v1/cards/${card_uuid}/wishlist`, { wishlisted: !current });
    setCards(prev => prev.filter(c => c.card_uuid !== card_uuid)); // remove from list when unhearted
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-0 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Wishlist</h1>
          <p className="text-sm text-neutral-400">{cards.length} wishlisted card{cards.length === 1 ? "" : "s"}</p>
        </div>
      </div>

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
            </tr>
          </thead>
          <tbody className="[&>tr]:border-t [&>tr]:border-neutral-800">
            {cards.map((c) => (
              <tr key={c.card_uuid} className="hover:bg-neutral-900/60">
                <td className="px-3 py-2">
                  <button
                    className="inline-flex items-center justify-center w-6 h-6"
                    title="Remove from wishlist"
                    onClick={() => toggleWishlist(c.card_uuid, c.wishlisted)}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-pink-600 stroke-pink-600">
                      <path strokeWidth="1.6" d="M12 21s-5.052-3.142-7.5-5.59C2.5 13.41 2 11.7 2 10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 1.7-.5 3.41-2.5 5.41C17.052 17.858 12 21 12 21z"/>
                    </svg>
                  </button>
                </td>
                <td className="px-3 py-2">{c.year ?? ""}</td>
                <td className="px-3 py-2">{c.brand ?? ""}</td>
                <td className="px-3 py-2">{c.set_name ?? ""}</td>
                <td className="px-3 py-2">{c.card_no ?? ""}</td>
                <td className="px-3 py-2">{c.player ?? ""}</td>
                <td className="px-3 py-2">{c.sport ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="border-t border-neutral-800 p-3 text-sm text-neutral-400">Loading…</div>}
        {!loading && cards.length === 0 && (
          <div className="border-t border-neutral-800 p-6 text-center text-sm text-neutral-400">No wishlisted cards.</div>
        )}
      </div>
    </div>
  );
}
