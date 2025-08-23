// app/ui/src/pages/Ownership.tsx
import { useEffect, useState } from "react";
import api from "../lib/api";
import { PageShell, Toolbar, SearchField, ActionButton, CardSection, TableShell, th, td } from "../components/kit";

type Ownership = {
  ownership_uuid: string;
  card_uuid: string;
  // add whatever fields you already use on this page:
  purchased_at?: string;
  price_paid?: number;
  grade?: string;
  cert_no?: string;
  notes?: string;
  created_at: string;
  // you might already join card fields; if not, keep as-is
  card?: { year?: number; brand?: string; set_name?: string; card_no?: string; player?: string; sport?: string };
};

export default function OwnershipPage() {
  const [rows, setRows] = useState<Ownership[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<any>({}); // keep your current form shape

  async function load() {
    const { data } = await api.get<Ownership[]>("/v1/ownership", { params: q ? { q } : {} });
    setRows(data);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [q]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    // keep your endpoint/shape
    await api.post("/v1/ownership", form);
    setForm({});
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this ownership?")) return;
    await api.delete(`/v1/ownership/${id}`);
    await load();
  }

  return (
    <PageShell>
      <Toolbar>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Ownership</h1>
          <p className="text-sm text-neutral-400">{rows.length} record{rows.length === 1 ? "" : "s"}</p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <SearchField value={q} onChange={setQ} placeholder="Search player / brand / set / notes…" />
          {/* If you have CSV import/export for ownership, add them here; else omit */}
          {/* <ActionButton>Import CSV</ActionButton> */}
          {/* <a className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-750" href="..." target="_blank" rel="noreferrer">Export CSV</a> */}
        </div>
      </Toolbar>

      {/* Quick create form — move your existing inputs here */}
      <CardSection className="p-2">
        <form onSubmit={create} className="grid grid-cols-2 gap-2 md:grid-cols-6">
          {/* Examples — replace with YOUR fields */}
          <input
            className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none"
            placeholder="Card UUID"
            value={form.card_uuid ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, card_uuid: e.target.value }))}
          />
          <input
            className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none"
            placeholder="Price"
            value={form.price_paid ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, price_paid: e.target.value }))}
          />
          <input
            className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none"
            placeholder="Purchased at (YYYY-MM-DD)"
            value={form.purchased_at ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, purchased_at: e.target.value }))}
          />
          <input
            className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none"
            placeholder="Grade"
            value={form.grade ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, grade: e.target.value }))}
          />
          <input
            className="rounded border border-neutral-700 bg-neutral-950 p-2 text-sm focus:border-neutral-500 focus:outline-none"
            placeholder="Cert #"
            value={form.cert_no ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, cert_no: e.target.value }))}
          />
          <div className="flex items-center justify-end">
            <ActionButton tone="primary" type="submit">Add</ActionButton>
          </div>
        </form>
      </CardSection>

      {/* Table */}
      <TableShell>
        <table className="w-full text-sm">
          <thead className={`sticky top-0 bg-neutral-900/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/70 ${th}`}>
            <tr>
              <th>Card</th>
              <th>Price</th>
              <th>Purchased</th>
              <th>Grade</th>
              <th>Cert</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-t [&>tr]:border-neutral-800">
            {rows.map((r) => (
              <tr key={r.ownership_uuid} className="hover:bg-neutral-900/60">
                <td className={td}>
                  {/* Show either joined card info or the raw UUID */}
                  {r.card
                    ? `${r.card.year ?? ""} ${r.card.brand ?? ""} ${r.card.set_name ?? ""} #${r.card.card_no ?? ""} — ${r.card.player ?? ""}`
                    : r.card_uuid}
                </td>
                <td className={td}>{r.price_paid ?? ""}</td>
                <td className={td}>{r.purchased_at ?? ""}</td>
                <td className={td}>{r.grade ?? ""}</td>
                <td className={td}>{r.cert_no ?? ""}</td>
                <td className={td}>{r.notes ?? ""}</td>
                <td className={`${td} text-right`}>
                  <button className="text-red-400 hover:text-red-300" onClick={() => remove(r.ownership_uuid)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="border-t border-neutral-800 p-6 text-center text-sm text-neutral-400">No ownership records yet.</div>
        )}
      </TableShell>
    </PageShell>
  );
}
