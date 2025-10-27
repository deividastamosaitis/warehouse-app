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

const BATCH_WINDOW_MS = 400; // per kiek ms kaupiame vienodą barkodą

export default function Scan() {
  const scanInputRef = useRef(null);
  const idleTimerRef = useRef(null);

  // Veiksmas: IN arba OUT
  const [action, setAction] = useState("IN");

  // Automatinis režimas su kaupimu
  const [autoMode, setAutoMode] = useState(true);
  const [autoQty, setAutoQty] = useState(1);
  const [autoInvoice, setAutoInvoice] = useState("");

  // Modal / forma
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);

  const [isExisting, setIsExisting] = useState(false);
  const [current, setCurrent] = useState(null);
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [manufacturerName, setManufacturerName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [groupId, setGroupId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(""); // tik IN (per modalą)
  const [message, setMessage] = useState("");
  const HISTORY_KEY = "scan_history_v1";

  // Kaupimo sandėlis: Map<key, {code, action, count, timerId, name?}>
  const batchRef = useRef(new Map());
  const [batchView, setBatchView] = useState([]); // UI peržiūrai

  // Toasts
  const [toasts, setToasts] = useState([]);
  const pushToast = (kind, text, title) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t, { id, kind, text, title }]);
    setTimeout(() => removeToast(id), 2500);
  };
  const removeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  // Garso signalai (WebAudio)
  const audioCtxRef = useRef(null);
  function ensureAudioCtx() {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }
  async function beep(freq = 880, ms = 120, type = "sine", gain = 0.05) {
    try {
      const ctx = ensureAudioCtx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        osc.disconnect();
        g.disconnect();
      }, ms);
    } catch {}
  }
  const soundOk = async () => {
    await beep(1000, 120, "sine", 0.07);
  };
  const soundWarn = async () => {
    await beep(600, 80, "square", 0.05);
  };
  const soundErr = async () => {
    await beep(300, 120, "square", 0.06);
    setTimeout(() => beep(250, 150, "square", 0.06), 130);
  };

  // Istorija
  const [history, setHistory] = useState([]);
  const didLoadHistoryRef = useRef(false);
  useEffect(() => {
    if (didLoadHistoryRef.current) return;
    didLoadHistoryRef.current = true;
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setHistory(arr);
      }
    } catch {}
  }, []);
  const addHistory = (entry) => {
    const row = { time: new Date().toLocaleString(), ...entry };
    setHistory((h) => {
      const next = [row, ...h].slice(0, 80); // laikom iki 80 įrašų
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
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
    }, 150);
  }

  function finalizeScan() {
    const code = (scanInputRef.current?.value || "").trim();
    if (!code) return;
    scanInputRef.current.value = "";
    handleScanned(code);
  }

  // ───────── Kaupimo logika ─────────
  function syncBatchView() {
    const arr = Array.from(batchRef.current.values()).map((b) => ({
      key: `${b.action}:${b.code}`,
      code: b.code,
      action: b.action,
      count: b.count,
      name: b.name || "",
    }));
    setBatchView(arr);
  }

  function scheduleBatch({ action, code, name }) {
    const key = `${action}:${code}`;
    const m = batchRef.current;
    const prev = m.get(key) || { action, code, count: 0, timerId: null, name };

    // Jeigu vėliau sužinom pavadinimą – įsirašom
    if (name && !prev.name) prev.name = name;

    prev.count += Math.max(1, Number(autoQty) || 1);
    if (prev.timerId) clearTimeout(prev.timerId);
    prev.timerId = setTimeout(() => flushBatch(key), BATCH_WINDOW_MS);
    m.set(key, prev);
    syncBatchView();
  }

  async function flushBatch(key) {
    const m = batchRef.current;
    const entry = m.get(key);
    if (!entry) return;
    m.delete(key);
    syncBatchView();

    const { action: act, code, count } = entry;

    try {
      const existing = await getProductByBarcode(code);
      const pname = existing?.name || entry.name || code;

      if (act === "IN") {
        await intakeScan({
          barcode: code,
          quantity: count,
          invoiceNumber: (autoInvoice || "").trim(),
        });
        pushToast(
          "success",
          `+${count} vnt. pridėta${
            autoInvoice ? ` (sąsk.: ${autoInvoice})` : ""
          }: ${pname}`,
          "Pridėta (auto)"
        );
        addHistory({
          code,
          name: pname,
          manufacturer: existing?.manufacturer?.name || "",
          qty: count,
          status: "Pridėta (auto)",
          invoiceNumber: autoInvoice || "",
        });
        soundOk();
      } else {
        // OUT
        const available = existing?.quantity || 0;
        if (available <= 0) {
          pushToast("error", `Negalima išimti – ${pname} likutis 0.`, "Klaida");
          addHistory({
            code,
            name: pname,
            qty: 0,
            status: "OUT atmesta (0 likutis)",
          });
          soundErr();
          return;
        }
        const toRemove = Math.min(count, available);
        await adjustQuantity(
          existing._id,
          -toRemove,
          "Automatinis OUT (sukaupta)"
        );
        pushToast(
          "success",
          `-${toRemove} vnt. išimta: ${pname}`,
          "Išimta (auto)"
        );
        addHistory({
          code,
          name: pname,
          qty: -toRemove,
          status:
            toRemove < count
              ? `Išimta dalinai (prašyta ${count}, buvo ${available})`
              : "Išimta (auto)",
        });
        if (toRemove < count) {
          soundWarn();
        } else {
          soundOk();
        }
      }
    } catch (e) {
      pushToast(
        "error",
        e?.response?.data?.message || "Klaida apdorojant partiją",
        "Klaida"
      );
      soundErr();
    }
  }
  // ──────── (END) Kaupimo logika ────────

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

      if (autoMode) {
        // Automatinis – kaupiam ir flush'insim po BATCH_WINDOW_MS
        if (
          action === "OUT" &&
          (!existing.quantity || existing.quantity <= 0)
        ) {
          pushToast("error", "Negalima išimti: kiekis sandėlyje 0.", "Klaida");
          soundErr();
          scanInputRef.current?.focus();
          return;
        }
        scheduleBatch({ action, code, name: existing.name });
        scanInputRef.current?.focus();
        return;
      }

      // Įprastas (modalas)
      if (action === "OUT" && (!existing.quantity || existing.quantity <= 0)) {
        pushToast(
          "error",
          "Negalima išimti: kiekis sandėlyje yra 0.",
          "Klaida"
        );
        soundErr();
        scanInputRef.current?.focus();
        return;
      }

      setOpen(true);
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
      // NAUJA PREKĖ
      if (action === "OUT") {
        pushToast(
          "error",
          "Šio barkodo sistemoje nėra – OUT negalimas.",
          "Klaida"
        );
        soundErr();
        scanInputRef.current?.focus();
        return;
      }

      if (autoMode) {
        // Auto IN naujai prekei – vis tiek reikia duomenų (modalas)
        setIsExisting(false);
        setCurrent(null);
        setName("");
        setManufacturerId("");
        setManufacturerName("");
        setGroupId("");
        setSupplierId("");
        setInvoiceNumber(autoInvoice || "");
        setOpen(true);
        setTimeout(() => document.getElementById("name-input")?.focus(), 0);
        addHistory({
          code,
          name: "",
          manufacturer: "",
          qty: 0,
          status: "Nauja prekė – įveskite pavadinimą",
        });
        soundWarn();
        return;
      }

      // Įprastas režimas (modalas)
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
      soundWarn();
    }
  }

  async function onSubmit() {
    setLoading(true);
    setMessage("");

    try {
      const qtyNum = Math.max(1, Number(quantity) || 1);

      if (action === "IN") {
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
        soundOk();
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
        // OUT – tik esamai prekei, su pakankamu likučiu
        if (!isExisting || !current?._id) {
          pushToast(
            "error",
            "Negalima išimti – prekės nėra sistemoje.",
            "Klaida"
          );
          soundErr();
          return;
        }
        if (qtyNum > (current.quantity || 0)) {
          pushToast(
            "error",
            `Negalima išimti ${qtyNum} vnt. – sandėlyje tik ${current.quantity} vnt.`,
            "Nepakanka kiekio"
          );
          soundErr();
          return;
        }

        await adjustQuantity(current._id, -qtyNum, "Išėmimas pagal skenavimą");

        pushToast(
          "success",
          `-${qtyNum} vnt. išimta: ${current.name}`,
          "Išimta"
        );
        soundOk();
        addHistory({
          code: barcode,
          name: current.name,
          manufacturer: current.manufacturer?.name || "",
          qty: -qtyNum,
          status: "Išimta",
        });

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
      pushToast(
        "error",
        e?.response?.data?.message || "Įvyko klaida",
        "Klaida"
      );
      soundErr();
    } finally {
      setLoading(false);
    }
  }

  function chooseAction(kind) {
    setAction(kind);
    // mažas garsinis patvirtinimas (nebūtina keisti)
    if (kind === "IN") soundOk();
    else soundWarn();
    // fokusas į skenavimo lauką
    requestAnimationFrame(() => scanInputRef.current?.focus());
  }

  function btnClass(kind) {
    const isActive = action === kind;
    const base =
      "w-full rounded-2xl flex items-center justify-center px-6 py-6 md:py-10 text-2xl md:text-3xl font-extrabold tracking-wide shadow-lg hover:shadow-xl transition active:scale-[0.99]";
    const ring = isActive
      ? kind === "IN"
        ? " ring-8 ring-green-300"
        : " ring-8 ring-red-300"
      : "";
    if (!isActive) {
      // NEAKTYVUS — PILKAS
      return `${base} bg-gray-200 text-gray-500 ${ring}`;
    }
    // AKTYVUS — SPALVOTAS
    return (
      base +
      (kind === "IN"
        ? " text-white bg-gradient-to-br from-green-500 to-green-700"
        : " text-white bg-gradient-to-br from-red-500 to-red-700") +
      ring
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Priėmimas / Skenavimas</h1>

      {/* Veiksmo pasirinkimas + auto režimas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => chooseAction("IN")}
          className={btnClass("IN")}
          aria-label="Pridėti (IN)"
          aria-pressed={action === "IN"}
        >
          <span className="inline-flex items-center gap-3">
            <span className="text-3xl md:text-4xl">➕</span>
            <span>PRIDĖTI (IN)</span>
          </span>
        </button>

        <button
          onClick={() => chooseAction("OUT")}
          className={btnClass("OUT")}
          aria-label="Atimti (OUT)"
          aria-pressed={action === "OUT"}
        >
          <span className="inline-flex items-center gap-3">
            <span className="text-3xl md:text-4xl">➖</span>
            <span>ATIMTI (OUT)</span>
          </span>
        </button>
      </div>

      {/* Papildomi nustatymai – po mygtukais */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <label className="inline-flex items-center gap-2 bg-white border rounded-2xl px-3 py-2">
          <input
            type="checkbox"
            checked={autoMode}
            onChange={(e) => setAutoMode(e.target.checked)}
          />
          <span className="font-medium">Automatinis režimas (kaupimas)</span>
        </label>

        <label className="inline-flex items-center gap-2 bg-white border rounded-2xl px-3 py-2">
          <span className="text-sm text-gray-600">Kiekis (auto)</span>
          <input
            type="number"
            min={1}
            value={autoQty}
            onChange={(e) => setAutoQty(Number(e.target.value || 1))}
            className="border rounded-xl p-2 w-24"
          />
          <span className="text-sm text-gray-600">vnt.</span>
        </label>

        {action === "IN" && (
          <label className="inline-flex items-center gap-2 bg-white border rounded-2xl px-3 py-2">
            <span className="text-sm text-gray-600">
              Sąsk. nr. (auto, nebūtina)
            </span>
            <input
              value={autoInvoice}
              onChange={(e) => setAutoInvoice(e.target.value)}
              className="border rounded-xl p-2 w-44"
              placeholder="PVZ-12345"
            />
          </label>
        )}
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

          {/* Kaupiamų skenavimų būsenos rodinys */}
          {autoMode && batchView.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Kaupiama:</h3>
              <div className="max-h-40 overflow-auto divide-y border rounded-xl">
                {batchView.map((b) => (
                  <div
                    key={b.key}
                    className="px-3 py-2 text-sm flex justify-between"
                  >
                    <div className="truncate">
                      <span className="font-mono">{b.code}</span>{" "}
                      <span className="text-gray-600">— {b.name || "..."}</span>
                    </div>
                    <div
                      className={`font-semibold ${
                        b.action === "OUT" ? "text-red-700" : "text-green-700"
                      }`}
                    >
                      {b.action} × {b.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      {/* MODALAS (tik kai reikia ranka patvirtinti / sukurti naują) */}
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
