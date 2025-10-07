import { useEffect, useRef, useState } from "react";
import {
  intakeScan,
  fetchGroups,
  fetchSuppliers,
  fetchManufacturers,
  getProductByBarcode,
} from "../api";
import Modal from "../components/Modal";
import Select from "../components/Select";
import Toasts from "../components/Toasts";

export default function Scan() {
  const scanInputRef = useRef(null);
  const idleTimerRef = useRef(null);

  const [quickMode, setQuickMode] = useState(true);
  const [quickQty, setQuickQty] = useState(1);

  const [scanned, setScanned] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);

  const [isExisting, setIsExisting] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [manufacturerId, setManufacturerId] = useState(""); // <— ID vietoje teksto
  const [manufacturerName, setManufacturerName] = useState(""); // tik rodymui
  const [quantity, setQuantity] = useState(1);
  const [groupId, setGroupId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [message, setMessage] = useState("");

  const [toasts, setToasts] = useState([]);
  const pushToast = (kind, text, title) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t, { id, kind, text, title }]);
    setTimeout(() => removeToast(id), 2500);
  };
  const removeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const [history, setHistory] = useState([]);
  const addHistory = (entry) => {
    const row = { time: new Date().toLocaleTimeString(), ...entry };
    setHistory((h) => [row, ...h].slice(0, 30));
  };

  useEffect(() => {
    fetchGroups()
      .then(setGroups)
      .catch(() => {});
    fetchSuppliers()
      .then(setSuppliers)
      .catch(() => {});
    fetchManufacturers()
      .then(setManufacturers)
      .catch(() => {});
    scanInputRef.current?.focus();
  }, []);

  function onScanKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      finalizeScan();
      return;
    }
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      const v = (scanInputRef.current?.value || "").trim();
      if (v.length >= 6) finalizeScan();
    }, 250);
  }

  function finalizeScan() {
    const code = (scanInputRef.current?.value || "").trim();
    if (!code) return;
    scanInputRef.current.value = "";
    handleScanned(code);
  }

  async function handleScanned(code) {
    setScanned(code);
    setBarcode(code);
    setQuantity(1);
    setMessage("");

    try {
      const existing = await getProductByBarcode(code);

      if (quickMode) {
        const qty = Number(quickQty) || 1;
        await intakeScan({ barcode: code, quantity: qty });
        pushToast(
          "success",
          `+${qty} vnt. pridėta: ${existing.name}`,
          "Prekė pridėta"
        );
        addHistory({
          code,
          name: existing.name,
          manufacturer: existing.manufacturer?.name,
          qty,
          status: "Pridėta (greitas)",
        });
        scanInputRef.current?.focus();
        return;
      }

      setIsExisting(true);
      setName(existing.name);
      setManufacturerId(existing.manufacturer?._id || "");
      setManufacturerName(existing.manufacturer?.name || "");
      setGroupId(existing.group?._id || "");
      setSupplierId(existing.supplier?._id || "");
      setOpen(true);
      setTimeout(() => document.getElementById("qty-input")?.focus(), 0);
      addHistory({
        code,
        name: existing.name,
        manufacturer: existing.manufacturer?.name,
        qty: 0,
        status: "Laukia patvirtinimo",
      });
    } catch {
      // naujas
      setIsExisting(false);
      setName("");
      setManufacturerId("");
      setManufacturerName("");
      setGroupId("");
      setSupplierId("");
      setOpen(true);
      setTimeout(() => document.getElementById("name-input")?.focus(), 0);
      addHistory({
        code,
        name: "",
        manufacturer: "",
        qty: 0,
        status: "Nauja prekė – įveskite pavadinimą",
      });
    }
  }

  async function onSubmit() {
    setLoading(true);
    setMessage("");
    try {
      const payload = {
        barcode,
        quantity: Number(quantity),
        ...(isExisting ? {} : { name: name.trim(), manufacturerId }),
        groupId,
        supplierId,
      };
      const result = await intakeScan(payload);

      pushToast(
        "success",
        `+${payload.quantity} vnt. pridėta: ${result.name}`,
        "Prekė pridėta"
      );
      addHistory({
        code: barcode,
        name: result.name,
        manufacturer: result.manufacturer?.name,
        qty: payload.quantity,
        status: isExisting ? "Pridėta" : "Sukurta ir pridėta",
      });

      setIsExisting(true);
      setName(result.name);
      setManufacturerId(result.manufacturer?._id || "");
      setManufacturerName(result.manufacturer?.name || "");
      setMessage(`OK! Pridėta. Dabartinis kiekis: ${result.quantity}`);
      setOpen(false);
      scanInputRef.current?.focus();
    } catch (e) {
      setMessage(e?.response?.data?.message || "Įvyko klaida");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">
        Priėmimas / Skenavimas (skeneriu)
      </h1>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={quickMode}
            onChange={(e) => setQuickMode(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="font-medium">Greitas priėmimas</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <span className="text-sm text-gray-600">Kiekis (greitam)</span>
          <input
            type="number"
            min={1}
            value={quickQty}
            onChange={(e) => setQuickQty(Number(e.target.value || 1))}
            className="border rounded-xl p-2 w-24"
          />
          <span className="text-sm text-gray-600">vnt.</span>
        </label>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-4 border">
          <label className="block">
            <span className="text-sm text-gray-600">Skenavimo laukas</span>
            <input
              ref={scanInputRef}
              onKeyDown={onScanKeyDown}
              placeholder="Barkodas (su skeneriu automatiškai pasispaudžia ENTER)"
              className="mt-1 w-full border rounded-xl p-3"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              onClick={finalizeScan}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white"
            >
              Tęsti (jei įvesta ranka)
            </button>
            <button
              onClick={() => scanInputRef.current?.focus()}
              className="px-4 py-2 rounded-xl bg-gray-200"
            >
              Fokusas į skenavimą
            </button>
          </div>
        </div>

        {/* ISTORIJA */}
        <div className="bg-white rounded-2xl p-4 border">
          <h2 className="font-semibold mb-2">Skenavimo istorija</h2>
          {history.length === 0 ? (
            <div className="text-gray-500">Kol kas nieko.</div>
          ) : (
            <div className="max-h-96 overflow-auto divide-y">
              {history.map((h, i) => (
                <div key={i} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {h.name || "— nauja prekė —"}
                    </div>
                    <div className="text-gray-500">{h.time}</div>
                  </div>
                  <div className="text-gray-600">
                    Barkodas: <span className="font-mono">{h.code}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-gray-600">
                      Kiekis: <strong>{h.qty}</strong>
                    </div>
                    <div className="text-gray-700">{h.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODALAS */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          scanInputRef.current?.focus();
        }}
        title="Naujas priėmimas"
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-gray-600">Barkodas</span>
            <input
              value={barcode}
              disabled
              className="mt-1 w-full border rounded-xl p-2 bg-gray-100"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-600">Kiekis</span>
            <input
              id="qty-input"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
              className="mt-1 w-full border rounded-xl p-2"
            />
          </label>

          {!isExisting && (
            <>
              <label className="block col-span-2">
                <span className="text-sm text-gray-600">
                  Prekės pavadinimas
                </span>
                <input
                  id="name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full border rounded-xl p-2"
                  placeholder="Pvz. Varžtas M6"
                />
              </label>
              <Select
                label="Gamintojas"
                value={manufacturerId}
                onChange={setManufacturerId}
                options={manufacturers}
              />
            </>
          )}
          {isExisting && (
            <label className="block">
              <span className="text-sm text-gray-600">Gamintojas</span>
              <input
                value={manufacturerName || "—"}
                disabled
                className="mt-1 w-full border rounded-xl p-2 bg-gray-100"
              />
            </label>
          )}

          <Select
            label="Prekių grupė"
            value={groupId}
            onChange={setGroupId}
            options={groups}
          />
          <Select
            label="Tiekėjas"
            value={supplierId}
            onChange={setSupplierId}
            options={suppliers}
          />
        </div>

        {isExisting && (
          <div className="text-sm text-gray-600 mt-2">
            Rasta esama prekė: <strong>{name}</strong> (
            {manufacturerName || "—"}). Pavadinimo ir gamintojo keisti nereikia.
          </div>
        )}
        {message && <div className="text-sm mt-2">{message}</div>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => {
              setOpen(false);
              scanInputRef.current?.focus();
            }}
            className="px-4 py-2 rounded-xl bg-gray-200"
          >
            Uždaryti
          </button>
          <button
            disabled={loading}
            onClick={onSubmit}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white"
          >
            {loading ? "Siunčiama..." : "Patvirtinti"}
          </button>
        </div>
      </Modal>

      <Toasts items={toasts} onClose={removeToast} />
    </div>
  );
}
