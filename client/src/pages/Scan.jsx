import { useEffect, useRef, useState } from "react";
import { intakeScan, fetchGroups, fetchSuppliers } from "../api";
import Modal from "../components/Modal";
import Select from "../components/Select";

export default function Scan() {
  const readerId = "reader";
  const startedRef = useRef(false); // saugom ar startuotas
  const qrRef = useRef(null); // Html5Qrcode instancija
  const unmountedRef = useRef(false); // ar komponentas unmountintas

  const [permissionError, setPermissionError] = useState("");
  const [scanned, setScanned] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Forma
  const [isExisting, setIsExisting] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [groupId, setGroupId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchGroups()
      .then(setGroups)
      .catch(() => {});
    fetchSuppliers()
      .then(setSuppliers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    unmountedRef.current = false;

    async function startScanner() {
      try {
        // Patogus patarimas: kamera reikalauja HTTPS (išskyrus localhost)
        const isLocalhost =
          location.hostname === "localhost" ||
          location.hostname === "127.0.0.1";
        if (!isLocalhost && location.protocol !== "https:") {
          setPermissionError(
            "Kamerai reikia HTTPS (išskyrus localhost). Atidarykite aplikaciją per https://"
          );
          return;
        }

        const el = document.getElementById(readerId);
        if (!el) {
          // Jei navigavote į kitą puslapį – nedarom nieko
          return;
        }

        const { Html5Qrcode } = await import("html5-qrcode");
        // saugiklis prieš React StrictMode (dvigubas effect mount dev režime)
        if (startedRef.current) return;

        qrRef.current = new Html5Qrcode(readerId);
        const cams = await Html5Qrcode.getCameras();

        if (!cams || cams.length === 0) {
          setPermissionError("Nerasta kamerų arba prieiga negauta.");
          return;
        }

        const camId = cams[0].id;
        await qrRef.current.start(
          camId,
          { fps: 10, qrbox: 250, rememberLastUsedCamera: true },
          (decodedText) => {
            if (!decodedText) return;
            // kad nebūtų kilpų
            if (decodedText !== scanned) {
              handleScanned(decodedText);
            }
          }
        );

        startedRef.current = true;
        setPermissionError("");
      } catch (err) {
        // Dažniausia – NotAllowedError (naudotojas neleido kameros)
        console.error(err);
        setPermissionError(
          err?.message || "Nepavyko paleisti kameros (gal neleidote prieigos?)"
        );
      }
    }

    startScanner();

    return () => {
      unmountedRef.current = true;
      // saugiai stabdom: jeigu nestartuota – nieko
      const inst = qrRef.current;
      qrRef.current = null;
      startedRef.current = false;
      if (inst) {
        try {
          inst
            .stop()
            .then(() => inst.clear())
            .catch(() => {}); // „Cannot stop, scanner is not running“ – ignoruojam
        } catch {}
      }
    };
    // ⚠️ nerišam nuo `scanned`, kad nepaleistų start/stop kiekvienam skenavimui
  }, []);

  function handleScanned(code) {
    if (!code) return;
    setScanned(code);
    setBarcode(code);
    setQuantity(1);
    setMessage("");
    setIsExisting(false);
    setOpen(true);
  }

  async function onSubmit() {
    setLoading(true);
    setMessage("");
    try {
      const payload = {
        barcode,
        quantity: Number(quantity),
        name: name.trim(),
        manufacturer: manufacturer.trim(),
        groupId,
        supplierId,
      };
      const result = await intakeScan(payload);
      setMessage(
        `OK! Pridėta į sandėlį. Dabartinis kiekis: ${result.quantity}`
      );
      setIsExisting(true);
      setName(result.name);
      setManufacturer(result.manufacturer);
    } catch (e) {
      setMessage(e?.response?.data?.message || "Įvyko klaida");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Priėmimas / Skenavimas</h1>

      {permissionError && (
        <div className="mb-3 p-3 rounded-xl bg-yellow-100 text-yellow-900 border border-yellow-300">
          {permissionError}
          <div className="text-sm text-yellow-800 mt-1">
            Patikrinkite naršyklės kameros leidimus (adresų juostos spynelė) ir
            atnaujinkite puslapį.
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <div
            id={readerId}
            className="rounded-2xl overflow-hidden border bg-white"
            style={{ minHeight: 320 }}
          />
          <div className="mt-3 flex gap-2">
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Įvesti barkodą ranka"
              className="border rounded-xl p-2 flex-1"
            />
            <button
              onClick={() => handleScanned(barcode)}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white"
            >
              Tęsti
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Jei kamera neveikia – įveskite barkodą ranka.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border">
          <h2 className="font-semibold">Paskutinis barkodas:</h2>
          <p className="text-lg">{scanned || "—"}</p>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
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
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 w-full border rounded-xl p-2"
            />
          </label>
          <label className="block col-span-2">
            <span className="text-sm text-gray-600">
              Prekės pavadinimas {isExisting && "(negalima keisti)"}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isExisting}
              className="mt-1 w-full border rounded-xl p-2"
              placeholder="Pvz. Varžtas M6"
            />
          </label>
          <label className="block col-span-2">
            <span className="text-sm text-gray-600">
              Gamintojas {isExisting && "(negalima keisti)"}
            </span>
            <input
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              disabled={isExisting}
              className="mt-1 w-full border rounded-xl p-2"
              placeholder="Pvz. Bosch"
            />
          </label>
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

        {message && <div className="text-sm mt-2">{message}</div>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
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
    </div>
  );
}
