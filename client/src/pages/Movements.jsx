import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMovements } from "../api";

export default function Movements() {
  const [q, setQ] = useState("");

  const [productId, setProductId] = useState("");
  const [type, setType] = useState("");
  const [invoice, setInvoice] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [items, setItems] = useState([]);
  const [pager, setPager] = useState({ total: 0, page: 1, limit: 50 });

  const didInitRef = useRef(false);

  const load = useCallback(
    async (page = 1) => {
      const { data, pagination: meta } = await fetchMovements({
        q: q || undefined, // <— NAUJA
        productId: productId || undefined,
        type: type || undefined,
        invoice: invoice || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: pager.limit,
      });
      setItems(data);
      setPager(meta);
    },
    [q, productId, type, invoice, dateFrom, dateTo, pager.limit]
  );

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    load(1);
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Prekių judėjimai</h1>

      <div className="bg-white border rounded-2xl p-4 grid md:grid-cols-7 gap-3 mb-4">
        {/* NAUJAS LAUKAS */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pavadinimas / Barkodas"
          className="border rounded-xl p-2"
        />
        <input
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          placeholder="Product ID (nebūtina)"
          className="border rounded-xl p-2"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border rounded-xl p-2"
        >
          <option value="">Tipas: visi</option>
          <option value="IN">IN (priėmimai)</option>
          <option value="OUT">OUT (išėmimai)</option>
        </select>
        <input
          value={invoice}
          onChange={(e) => setInvoice(e.target.value)}
          placeholder="Sąskaitos nr."
          className="border rounded-xl p-2"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border rounded-xl p-2"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border rounded-xl p-2"
        />
        <button
          onClick={() => load(1)}
          className="px-4 py-2 rounded-xl bg-gray-900 text-white"
        >
          Filtruoti
        </button>
      </div>

      <div className="overflow-x-auto bg-white border rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Tipas</th>
              <th className="text-left p-3">Prekė</th>
              <th className="text-left p-3">Barkodas</th>
              <th className="text-right p-3">Kiekis</th>
              <th className="text-left p-3">Sąskaita</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => {
              const isOut = m.type === "OUT";
              const rowCls = isOut ? "bg-red-50" : ""; // fono spalva OUT
              const textCls = isOut ? "text-red-700" : ""; // teksto spalva OUT
              const badgeCls =
                m.type === "IN"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800";

              return (
                <tr key={m._id} className={`border-t ${rowCls}`}>
                  <td className={`p-3 ${textCls}`}>
                    {new Date(m.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeCls}`}
                    >
                      {m.type}
                    </span>
                  </td>
                  <td className={`p-3 ${textCls}`}>{m.product?.name || "—"}</td>
                  <td className={`p-3 ${textCls}`}>
                    {m.product?.barcode || "—"}
                  </td>
                  <td className={`p-3 text-right ${textCls}`}>{m.quantity}</td>
                  <td className={`p-3 ${textCls}`}>{m.invoiceNumber || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-3">
        <div className="text-sm text-gray-600">Rasta: {pager.total}</div>
        <div className="flex gap-2">
          <button
            disabled={pager.page <= 1}
            onClick={() => load(pager.page - 1)}
            className="px-3 py-1 rounded-lg bg-gray-200 disabled:opacity-50"
          >
            Atgal
          </button>
          <button
            disabled={pager.page * pager.limit >= pager.total}
            onClick={() => load(pager.page + 1)}
            className="px-3 py-1 rounded-lg bg-gray-200 disabled:opacity-50"
          >
            Pirmyn
          </button>
        </div>
      </div>
    </div>
  );
}
