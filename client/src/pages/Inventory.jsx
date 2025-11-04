import { useEffect, useMemo, useState, useCallback } from "react";
import {
  searchProducts,
  fetchGroups,
  fetchSuppliers,
  fetchManufacturers,
  adjustQuantity,
  deleteProduct,
} from "../api";
import QuantityAdjustModal from "../components/QuantityAdjustModal";
import InvoicesModal from "../components/InvoicesModal"; // <— būtinai!

export default function Inventory() {
  const [q, setQ] = useState("");
  const [groupId, setGroupId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");

  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);

  const [items, setItems] = useState([]);
  const [pager, setPager] = useState({ total: 0, page: 1, limit: 50 });

  const [selected, setSelected] = useState(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const [invOpen, setInvOpen] = useState(false);
  const [invProduct, setInvProduct] = useState(null);

  const [invoice, setInvoice] = useState("");

  useEffect(() => {
    Promise.all([fetchGroups(), fetchSuppliers(), fetchManufacturers()]).then(
      ([gs, ss, ms]) => {
        setGroups(gs);
        setSuppliers(ss);
        setManufacturers(ms);
      }
    );
  }, []);

  const groupMap = useMemo(
    () => Object.fromEntries(groups.map((g) => [g._id, g.name])),
    [groups]
  );
  const supplierMap = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s._id, s.name])),
    [suppliers]
  );
  const manufacturerMap = useMemo(
    () => Object.fromEntries(manufacturers.map((m) => [m._id, m.name])),
    [manufacturers]
  );

  // debounce paieška/filtrai – kad nerednerintų per dažnai
  const [debounced, setDebounced] = useState({
    q: "",
    groupId: "",
    supplierId: "",
    manufacturerId: "",
    invoice: "",
  });
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced({ q, groupId, supplierId, manufacturerId, invoice });
    }, 250);
    return () => clearTimeout(t);
  }, [q, groupId, supplierId, manufacturerId, invoice]);

  const load = useCallback(
    async (page = 1) => {
      const params = {
        q: debounced.q,
        groupId: debounced.groupId,
        supplierId: debounced.supplierId,
        manufacturerId: debounced.manufacturerId,
        page,
        limit: pager.limit,
      };
      if (debounced.invoice?.trim()) params.invoice = debounced.invoice.trim();
      const { data, pagination: meta } = await searchProducts(params);
      setItems(data);
      setPager(meta);
    },
    [
      debounced.q,
      debounced.groupId,
      debounced.supplierId,
      debounced.manufacturerId,
      debounced.invoice,
      pager.limit,
    ]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  async function onAdjustConfirm(type, qty, note) {
    const delta = type === "IN" ? qty : -qty;
    await adjustQuantity(selected._id, delta, note);
    setAdjustOpen(false);
    await load(pager.page);
  }

  async function onDelete(id) {
    if (!confirm("Ištrinti prekę? (galima tik kai kiekis 0)")) return;
    try {
      await deleteProduct(id);
      await load(pager.page);
    } catch (e) {
      alert(e?.response?.data?.message || "Nepavyko ištrinti");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Prekių sąrašas</h1>

      <div className="bg-white border rounded-2xl p-4 grid md:grid-cols-6 gap-3 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Paieška (pavadinimas)"
          className="border rounded-xl p-2"
        />
        <input
          value={invoice}
          onChange={(e) => setInvoice(e.target.value)}
          placeholder="Sąskaitos nr."
          className="border rounded-xl p-2"
        />
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="border rounded-xl p-2"
        >
          <option value="">Visos grupės</option>
          {groups.map((g) => (
            <option key={g._id} value={g._id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="border rounded-xl p-2"
        >
          <option value="">Visi tiekėjai</option>
          {suppliers.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={manufacturerId}
          onChange={(e) => setManufacturerId(e.target.value)}
          className="border rounded-xl p-2"
        >
          <option value="">Visi gamintojai</option>
          {manufacturers.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => load(1)}
          className="px-4 py-2 rounded-xl bg-gray-900 text-white"
        >
          Atnaujinti
        </button>
      </div>

      <div className="overflow-x-auto bg-white border rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-3">Barkodas</th>
              <th className="text-left p-3">Pavadinimas</th>
              <th className="text-left p-3">Gamintojas</th>
              <th className="text-left p-3">Grupė</th>
              <th className="text-left p-3">Tiekėjas</th>
              <th className="text-right p-3">Kiekis</th>
              <th className="text-right p-3">Veiksmai</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id} className="border-t">
                <td className="p-3">{item.barcode}</td>
                <td className="p-3">{item.name}</td>
                <td className="p-3">
                  {manufacturerMap[item.manufacturer] || "—"}
                </td>
                <td className="p-3">{groupMap[item.group] || "—"}</td>
                <td className="p-3">{supplierMap[item.supplier] || "—"}</td>
                <td className="p-3 text-right font-semibold">
                  {item.quantity}
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      onClick={() => {
                        setInvProduct(item);
                        setInvOpen(true);
                      }}
                      className="px-3 py-1 rounded-lg bg-blue-600 text-white"
                    >
                      Sąskaitos
                    </button>
                    <button
                      onClick={() => {
                        setSelected(item);
                        setAdjustOpen(true);
                      }}
                      className="px-3 py-1 rounded-lg bg-gray-200"
                    >
                      Koreguoti
                    </button>
                    <button
                      onClick={() => onDelete(item._id)}
                      className="px-3 py-1 rounded-lg bg-red-600 text-white"
                    >
                      Trinti
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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

      <QuantityAdjustModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onConfirm={onAdjustConfirm}
      />
      <InvoicesModal
        product={invProduct}
        open={invOpen}
        onClose={() => setInvOpen(false)}
      />
    </div>
  );
}
