import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMovements } from "../api";

const USER_NAME_BY_ID = {
  "678d5aae9b0780254f713335": "Deividas",
  "678e9fa54074c5f3fc922d6e": "Ričardas",
  "67e15cfda9ee4d52d0083599": "Laimis",
  "67e2656bc73d9ced46b24afa": "Ramutė",
  "67e2656cc73d9ced46b24afd": "Raimonda",
  "683d3cfd2dc11d2bf89f2a7b": "Kristina",
  "6865414e74515ec37bcf0420": "Lukas",
  "6895962d6108e5c4cc7afb49": "Marijus",
};

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
              <th className="text-left p-3">Klientas</th>
              <th className="text-left p-3">Tel.</th>
              <th className="text-right p-3">Suma</th>
              <th className="text-left p-3">Kvitas</th>
              <th className="text-left p-3">Sąskaita</th>
              <th className="text-left p-3">Sukūrė</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => {
              const isOut = m.type === "OUT";
              const rowCls = isOut ? "bg-red-50" : "";
              const textCls = isOut ? "text-red-700" : "";
              const badgeCls =
                m.type === "IN"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800";

              return (
                <tr key={m._id} className={`border-t ${rowCls}`}>
                  {/* Data */}
                  <td className={`p-3 ${textCls}`}>
                    {new Date(m.createdAt).toLocaleString()}
                  </td>

                  {/* Tipas */}
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeCls}`}
                    >
                      {m.type}
                    </span>
                  </td>

                  {/* Prekė + barkodas */}
                  <td className={`p-3 ${textCls}`}>{m.product?.name || "—"}</td>
                  <td className={`p-3 ${textCls}`}>
                    {m.product?.barcode || "—"}
                  </td>

                  {/* Kiekis */}
                  <td className={`p-3 text-right ${textCls}`}>{m.quantity}</td>

                  {/* Klientas tik jei turim duomenis (dažniausiai OUT iš garantinio) */}
                  <td className="p-3">{m.clientName ? m.clientName : "—"}</td>
                  <td className="p-3">{m.clientPhone ? m.clientPhone : "—"}</td>

                  {/* Suma už šį judėjimą, jei perduota */}
                  <td className="p-3 text-right">
                    {typeof m.totalAmount === "number"
                      ? `${m.totalAmount.toFixed(2)} €`
                      : "—"}
                  </td>

                  {/* Kvito numeris – jei yra, rodom visada */}
                  <td className="p-3">{m.receiptNumber || "—"}</td>

                  {/* Sąskaitos nr. – tiek IN (tiekėjo), tiek OUT (kliento) */}
                  <td className="p-3">{m.invoiceNumber || "—"}</td>
                  <td className={`p-3 ${textCls}`}>
                    {m.createdByName
                      ? m.createdByName
                      : m.createdById && USER_NAME_BY_ID[m.createdById]
                      ? USER_NAME_BY_ID[m.createdById]
                      : "—"}
                  </td>
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
