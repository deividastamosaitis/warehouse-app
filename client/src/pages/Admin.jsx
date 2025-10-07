import { useEffect, useState } from "react";
import { fetchGroups, fetchSuppliers, fetchManufacturers, api } from "../api";

export default function Admin() {
  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);

  const [gName, setGName] = useState("");
  const [sName, setSName] = useState("");
  const [mName, setMName] = useState("");

  async function load() {
    const [gs, ss, ms] = await Promise.all([
      fetchGroups(),
      fetchSuppliers(),
      fetchManufacturers(),
    ]);
    setGroups(gs);
    setSuppliers(ss);
    setManufacturers(ms);
  }

  useEffect(() => {
    load();
  }, []);

  async function addGroup() {
    if (!gName.trim()) return;
    await api.post("/groups", { name: gName.trim() });
    setGName("");
    load();
  }
  async function addSupplier() {
    if (!sName.trim()) return;
    await api.post("/suppliers", { name: sName.trim() });
    setSName("");
    load();
  }
  async function addManufacturer() {
    if (!mName.trim()) return;
    await api.post("/manufacturers", { name: mName.trim() });
    setMName("");
    load();
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="bg-white border rounded-2xl p-4">
        <h2 className="text-xl font-semibold mb-3">Prekių grupės</h2>
        <div className="flex gap-2 mb-3">
          <input
            value={gName}
            onChange={(e) => setGName(e.target.value)}
            placeholder="Nauja grupė"
            className="border rounded-xl p-2 flex-1"
          />
          <button
            onClick={addGroup}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white"
          >
            Pridėti
          </button>
        </div>
        <ul className="space-y-1">
          {groups.map((g) => (
            <li key={g._id} className="p-2 bg-gray-50 rounded-xl border">
              {g.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white border rounded-2xl p-4">
        <h2 className="text-xl font-semibold mb-3">Tiekėjai</h2>
        <div className="flex gap-2 mb-3">
          <input
            value={sName}
            onChange={(e) => setSName(e.target.value)}
            placeholder="Naujas tiekėjas"
            className="border rounded-xl p-2 flex-1"
          />
          <button
            onClick={addSupplier}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white"
          >
            Pridėti
          </button>
        </div>
        <ul className="space-y-1">
          {suppliers.map((s) => (
            <li key={s._id} className="p-2 bg-gray-50 rounded-xl border">
              {s.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white border rounded-2xl p-4">
        <h2 className="text-xl font-semibold mb-3">Gamintojai</h2>
        <div className="flex gap-2 mb-3">
          <input
            value={mName}
            onChange={(e) => setMName(e.target.value)}
            placeholder="Naujas gamintojas"
            className="border rounded-xl p-2 flex-1"
          />
          <button
            onClick={addManufacturer}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white"
          >
            Pridėti
          </button>
        </div>
        <ul className="space-y-1">
          {manufacturers.map((m) => (
            <li key={m._id} className="p-2 bg-gray-50 rounded-xl border">
              {m.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
