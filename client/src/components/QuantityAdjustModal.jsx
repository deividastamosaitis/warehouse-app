import Modal from "./Modal";
import { useState } from "react";

export default function QuantityAdjustModal({ open, onClose, onConfirm }) {
  const [type, setType] = useState("OUT"); // OUT – atimti, IN – pridėti
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Koreguoti kiekį"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-200"
          >
            Atšaukti
          </button>
          <button
            onClick={() => onConfirm(type, qty, note)}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white"
          >
            Patvirtinti
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-gray-600">Veiksmas</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full border rounded-xl p-2"
          >
            <option value="OUT">Atimti</option>
            <option value="IN">Pridėti</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Kiekis</span>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value || "1"))}
            className="mt-1 w-full border rounded-xl p-2"
          />
        </label>
        <label className="col-span-2 block">
          <span className="text-sm text-gray-600">Pastaba</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full border rounded-xl p-2"
            placeholder="(nebūtina)"
          />
        </label>
      </div>
    </Modal>
  );
}
