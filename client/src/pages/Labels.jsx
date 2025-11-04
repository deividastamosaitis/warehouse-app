// client/src/pages/Labels.jsx
import { useState } from "react";
import { reserveBarcodes, assignBarcode, searchProducts } from "../api";
import { generateDK11201Label, generateDK11201Labels } from "../utils/labels";

export default function Labels() {
  // A) Greitas „laisvų“ vidinių barkodų generavimas (jei reikia lipdukų be priskyrimo)
  const [count, setCount] = useState(1);
  const [codes, setCodes] = useState([]);
  const [busyA, setBusyA] = useState(false);

  async function onReserve(n = count) {
    setBusyA(true);
    try {
      const howMany = Math.max(1, Number(n) || 1);
      const list = await reserveBarcodes(howMany);
      setCodes(list);
    } finally {
      setBusyA(false);
    }
  }

  async function onPrintFree() {
    if (!codes.length) return alert("Pirma rezervuok barkodus.");
    await generateDK11201Labels(codes); // po vieną PDF kiekvienam
  }

  // B) Spausdinti pagal pasirinktą prekę (paieška pagal pavadinimą arba barkodą)
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busyB, setBusyB] = useState(false);
  const [copies, setCopies] = useState(1);

  async function doSearch() {
    const { data } = await searchProducts({ q, page: 1, limit: 30 });
    setResults(data);
  }

  async function printSelected() {
    if (!selected) return;
    if (!selected.barcode) {
      alert(
        "Ši prekė neturi barkodo. Pasinaudok mygtuku „Sugeneruoti, priskirti ir spausdinti“."
      );
      return;
    }
    const n = Math.max(1, Number(copies) || 1);
    for (let i = 0; i < n; i++) {
      await generateDK11201Label(String(selected.barcode));
    }
  }

  async function assignAndPrintOne() {
    if (!selected) return;
    setBusyB(true);
    try {
      // 1) rezervuojam 1 naują vidinį kodą
      const [code] = await reserveBarcodes(1);
      // 2) priskiriam pasirinktai prekei
      await assignBarcode(selected._id, code, false);
      // 3) atnaujinam lokaliai, kad rodytų turimą barkodą
      const updated = { ...selected, barcode: code };
      setSelected(updated);
      // 4) spausdinam 1 lipduką
      await generateDK11201Label(String(code));
    } catch (e) {
      alert(e?.response?.data?.message || "Nepavyko priskirti/spausdinti.");
    } finally {
      setBusyB(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* A) Laisvi vidiniai barkodai (nebūtina naudoti, bet patogu turėti) */}
      <div className="bg-white border rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-1">
          Generuoti vidinius barkodus (laisvi)
        </h2>
        <p className="mb-3 text-gray-400">
          Naudinga, kai reikia kelių tuščių lipdukų be priskyrimo prekei.
        </p>

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
            disabled={busyA}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white"
          >
            {busyA ? "Kuriama..." : "Rezervuoti"}
          </button>
          <button
            onClick={onPrintFree}
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

      {/* B) Spausdinti pasirinktai prekei */}
      <div className="bg-white border rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-1">
          Spausdinti prekės barkodą
        </h2>
        <p className="mb-3 text-gray-400">
          Įvesk pavadinimo fragmentą arba barkodą, pasirink prekę ir spausdink.
        </p>

        <div className="flex gap-2 mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pvz.: „varžtas“, „2449“, ar pilnas barkodas"
            className="border rounded-xl p-2 flex-1"
          />
          <button
            onClick={doSearch}
            className="px-4 py-2 rounded-xl bg-gray-200"
          >
            Ieškoti
          </button>
        </div>

        <div className="max-h-56 overflow-auto border rounded-xl divide-y mb-3">
          {results.map((p) => (
            <div
              key={p._id}
              onClick={() => setSelected(p)}
              className={`p-2 text-sm cursor-pointer ${
                selected?._id === p._id ? "bg-blue-50" : ""
              }`}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-gray-600">
                Barkodas: {p.barcode || "— nėra —"}
              </div>
              <div className="text-gray-600">Kiekis: {p.quantity}</div>
            </div>
          ))}
          {results.length === 0 && (
            <div className="p-3 text-sm text-gray-500">Nerasta.</div>
          )}
        </div>

        {selected && (
          <div className="bg-gray-50 border rounded-xl p-3 mb-3">
            <div className="font-medium">{selected.name}</div>
            <div className="text-gray-600">
              Barkodas: {selected.barcode || "— nėra —"}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <span className="text-sm text-gray-600">Kopijų</span>
            <input
              type="number"
              min={1}
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
              className="border rounded-xl p-2 w-24"
            />
          </label>

          <button
            onClick={printSelected}
            disabled={!selected}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
          >
            Spausdinti pasirinktą
          </button>

          {!selected?.barcode && (
            <button
              onClick={assignAndPrintOne}
              disabled={!selected || busyB}
              className="px-4 py-2 rounded-xl bg-green-600 text-white disabled:opacity-50"
              title="Sugeneruos 1 vidinį barkodą, priskirs prekei ir iškart atspausdins"
            >
              {busyB ? "Vykdoma..." : "Sugeneruoti, priskirti ir spausdinti"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
