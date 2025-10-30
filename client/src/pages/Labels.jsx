import { useState } from "react";
import { reserveBarcodes, assignBarcode, searchProducts } from "../api";
import { generateDK11201Label, generateDK11201Labels } from "../utils/labels";

export default function Labels() {
  const [count, setCount] = useState(1);
  const [codes, setCodes] = useState([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onReserve(n = count) {
    setBusy(true);
    try {
      const howMany = Math.max(1, Number(n) || 1);
      const list = await reserveBarcodes(howMany);
      setCodes(list);
    } finally {
      setBusy(false);
    }
  }

  async function onPrintDK() {
    if (!codes.length) return alert("Pirma rezervuok barkodus.");
    await generateDK11201Labels(codes);
  }

  async function doSearch() {
    const { data } = await searchProducts({ q, page: 1, limit: 20 });
    setResults(data);
  }

  async function onAssignAndPrint(code) {
    if (!selectedProduct) return alert("Pasirink prekę iš kairės.");
    setBusy(true);
    try {
      await assignBarcode(selectedProduct._id, code, false);
      await generateDK11201Label(code);
      alert(`Priskirtas barkodas ${code} prekei: ${selectedProduct.name}`);
    } catch (e) {
      alert(e?.response?.data?.message || "Nepavyko priskirti.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* 1) Rezervuoti ir spausdinti N kodų (be priskyrimo) */}
      <div className="bg-white border rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-1">
          Generuoti vidinius barkodus
        </h2>
        <p className="mb-3 text-gray-400">Nauja prekė (išparduotuvinė)</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="border rounded-xl p-2 w-28"
          />
          <button
            onClick={() => onReserve(count)}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white"
          >
            {busy ? "Kuriama..." : "Rezervuoti"}
          </button>
          <button
            onClick={onPrintDK}
            disabled={!codes.length}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
          >
            Spausdinti PDF (DK-11201)
          </button>
        </div>

        {codes.length > 0 && (
          <div className="mt-3 text-sm text-gray-700">
            Sukurta: {codes.length} vnt. (pvz.: {codes.slice(0, 3).join(", ")}
            {codes.length > 3 ? "..." : ""})
          </div>
        )}
      </div>

      {/* 2) Priskirti kodą konkrečiai prekei ir iškart atspausdinti */}
      <div className="bg-white border rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-1">Priskirti kodą prekei</h2>
        <p className="mb-3 text-gray-400">
          Esamai prekei, jei atėjo be originalaus barkodo
        </p>

        <div className="flex gap-2 mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Paieška pagal pavadinimą / fragmentą"
            className="border rounded-xl p-2 flex-1"
          />
          <button
            onClick={doSearch}
            className="px-4 py-2 rounded-xl bg-gray-200"
          >
            Ieškoti
          </button>
        </div>

        <div className="max-h-56 overflow-auto border rounded-xl divide-y">
          {results.map((p) => (
            <div
              key={p._id}
              onClick={() => setSelectedProduct(p)}
              className={`p-2 text-sm cursor-pointer ${
                selectedProduct?._id === p._id ? "bg-blue-50" : ""
              }`}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-gray-600">Barkodas: {p.barcode || "—"}</div>
              <div className="text-gray-600">Kiekis: {p.quantity}</div>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <button
            onClick={() => onReserve(1)}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white"
          >
            {busy ? "Kuriama..." : "Rezervuoti 1 kodą"}
          </button>
          <button
            onClick={() => {
              if (!codes.length) return alert("Pirma rezervuok 1 kodą.");
              onAssignAndPrint(codes[0]);
            }}
            className="ml-2 px-4 py-2 rounded-xl bg-green-600 text-white disabled:opacity-50"
            disabled={!selectedProduct || !codes.length}
          >
            Priskirti pasirinktai prekei ir spausdinti
          </button>
        </div>
      </div>
    </div>
  );
}
