import { useEffect, useRef, useState } from "react";
import {
  intakeScan,
  fetchGroups,
  fetchSuppliers,
  fetchManufacturers,
  getProductByBarcode,
  adjustQuantity,
} from "../api";
import Modal from "../components/Modal";
import Select from "../components/Select";
import Toasts from "../components/Toasts";

export default function Scan() {
  const scanInputRef = useRef(null);
  const idleTimerRef = useRef(null);

  // Veiksmas: IN arba OUT
  const [action, setAction] = useState("IN");

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);

  const [isExisting, setIsExisting] = useState(false);
  const [current, setCurrent] = useState(null); // visas produktas (kai yra)
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [manufacturerName, setManufacturerName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [groupId, setGroupId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(""); // tik IN
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
    Promise.all([fetchGroups(), fetchSuppliers(), fetchManufacturers()])
      .then(([gs, ss, ms]) => {
        setGroups(gs);
        setSuppliers(ss);
        setManufacturers(ms);
      })
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
    setBarcode(code);
    setQuantity(1);
    setMessage("");
    setInvoiceNumber("");

    try {
      const existing = await getProductByBarcode(code);

      // TURIMA PREKĖ
      setIsExisting(true);
      setCurrent(existing);
      setName(existing.name);
      setManufacturerId(existing.manufacturer?._id || "");
      setManufacturerName(existing.manufacturer?.name || "");
      setGroupId(existing.group?._id || "");
      setSupplierId(existing.supplier?._id || "");

      // Jei pasirinktas OUT, bet kiekis 0 – neleisti
      if (action === "OUT" && (!existing.quantity || existing.quantity <= 0)) {
        pushToast(
          "error",
          "Negalima išimti: kiekis sandėlyje yra 0.",
          "Klaida"
        );
        scanInputRef.current?.focus();
        return;
      }

      setOpen(true);
      // fokusas pagal veiksmą
      setTimeout(() => {
        const el = document.getElementById("qty-input");
        el?.focus();
        el?.select?.();
      }, 0);

      addHistory({
        code,
        name: existing.name,
        manufacturer: existing.manufacturer?.name,
        qty: 0,
        status: action === "IN" ? "Laukia pridėjimo" : "Laukia išėmimo",
      });
    } catch {
      // NAUJA PREKĖ: OUT draudžiam
      if (action === "OUT") {
        pushToast(
          "error",
          "Šio barkodo sistemoje nėra – negalima išimti.",
          "Klaida"
        );
        scanInputRef.current?.focus();
        return;
      }

      // Naujam IN – reikės pavadinimo ir gamintojo
      setIsExisting(false);
      setCurrent(null);
      setName("");
      setManufacturerId("");
      setManufacturerName("");
      setGroupId("");
      setSupplierId("");
      setInvoiceNumber("");
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
      const qtyNum = Math.max(1, Number(quantity) || 1);

      if (action === "IN") {
        // IN
        const payload = {
          barcode,
          quantity: qtyNum,
          ...(isExisting ? {} : { name: name.trim(), manufacturerId }),
          groupId,
          supplierId,
          invoiceNumber: invoiceNumber.trim(),
        };
        const result = await intakeScan(payload);

        pushToast(
          "success",
          `+${qtyNum} vnt. pridėta${
            invoiceNumber ? ` (sąsk.: ${invoiceNumber})` : ""
          }: ${result.name}`,
          "Prekė pridėta"
        );
        addHistory({
          code: barcode,
          name: result.name,
          manufacturer: result.manufacturer?.name,
          qty: qtyNum,
          status: isExisting ? "Pridėta" : "Sukurta ir pridėta",
          invoiceNumber: invoiceNumber || "",
        });
        setIsExisting(true);
        setName(result.name);
        setManufacturerId(result.manufacturer?._id || "");
        setManufacturerName(result.manufacturer?.name || "");
        setMessage(`OK! Pridėta. Dabartinis kiekis: ${result.quantity}`);
      } else {
        // OUT – leidžiama tik esamai prekei, su pakankamu likučiu
        if (!isExisting || !current?._id) {
          pushToast(
            "error",
            "Negalima išimti – prekės nėra sistemoje.",
            "Klaida"
          );
          return;
        }
        if (qtyNum > (current.quantity || 0)) {
          pushToast(
            "error",
            `Negalima išimti ${qtyNum} vnt. – sandėlyje tik ${current.quantity} vnt.`,
            "Nepakanka kiekio"
          );
          return;
        }

        await adjustQuantity(current._id, -qtyNum, "Išėmimas pagal skenavimą");

        pushToast(
          "success",
          `-${qtyNum} vnt. išimta: ${current.name}`,
          "Išimta"
        );
        addHistory({
          code: barcode,
          name: current.name,
          manufacturer: current.manufacturer?.name || "",
          qty: -qtyNum,
          status: "Išimta",
        });

        // atnaujink lokaliai rodoma info
        setMessage(
          `OK! Išimta. Dabartinis kiekis: ${(current.quantity || 0) - qtyNum}`
        );
        setCurrent((c) =>
          c ? { ...c, quantity: (c.quantity || 0) - qtyNum } : c
        );
      }

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
      <h1 className="text-2xl font-bold mb-4">Priėmimas / Skenavimas</h1>

      {/* Veiksmo pasirinkimas */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="inline-flex items-center gap-3 bg-white border rounded-2xl px-3 py-2">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="action"
              value="IN"
              checked={action === "IN"}
              onChange={() => setAction("IN")}
            />
            <span className="font-medium">Pridėti (IN)</span>
          </label>
          <span className="text-gray-300">|</span>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="action"
              value="OUT"
              checked={action === "OUT"}
              onChange={() => setAction("OUT")}
            />
            <span className="font-medium">Atimti (OUT)</span>
          </label>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* SKENAVIMAS */}
        <div className="bg-white rounded-2xl p-4 border">
          <label className="block">
            <span className="text-sm text-gray-600">Skenavimo laukas</span>
            <input
              ref={scanInputRef}
              onKeyDown={onScanKeyDown}
              placeholder="Barkodas (skeneris dažniausiai pats paspaudžia ENTER)"
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
                  {h.invoiceNumber ? (
                    <div className="text-gray-600">
                      Sąsk.: <strong>{h.invoiceNumber}</strong>
                    </div>
                  ) : null}
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
        title={action === "IN" ? "Priėmimas (IN)" : "Išėmimas (OUT)"}
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
            <span className="text-sm text-gray-600">
              Kiekis{" "}
              {action === "OUT" && current
                ? `(likutis: ${current.quantity})`
                : ""}
            </span>
            <input
              id="qty-input"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
              className={`mt-1 w-full border rounded-xl p-2 ${
                action === "OUT" ? "border-red-300" : ""
              }`}
            />
          </label>

          {action === "IN" && (
            <label className="block col-span-2">
              <span className="text-sm text-gray-600">
                Sąskaitos nr. (nebūtina)
              </span>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="mt-1 w-full border rounded-xl p-2"
                placeholder="PVZ-12345"
              />
            </label>
          )}

          {/* Naujos prekės laukeliai tik kai IN ir nėra tokios prekės */}
          {action === "IN" && !isExisting && (
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

          {/* Esamai prekei rodoma gamintojo info (nekoreguojama) */}
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
            {manufacturerName || "—"}).
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
            className={`px-4 py-2 rounded-xl text-white ${
              action === "OUT" ? "bg-red-600" : "bg-gray-900"
            }`}
          >
            {loading
              ? "Siunčiama..."
              : action === "OUT"
              ? "Išimti"
              : "Patvirtinti"}
          </button>
        </div>
      </Modal>

      <Toasts items={toasts} onClose={removeToast} />
    </div>
  );
}
